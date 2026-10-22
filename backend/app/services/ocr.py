import json
import logging
import math
import os
import shutil
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from PIL import Image
import pymupdf  # PyMuPDF fitz
import pytesseract
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.entities import Document, DocumentPage

logger = logging.getLogger("bhuverify.ocr")

TESSERACT_EXECUTABLE = None
if settings.TESSERACT_CMD and os.path.exists(settings.TESSERACT_CMD):
    TESSERACT_EXECUTABLE = settings.TESSERACT_CMD
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
else:
    potential_paths = [
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe")
    ]
    for p in potential_paths:
        if p and os.path.exists(p):
            TESSERACT_EXECUTABLE = p
            pytesseract.pytesseract.tesseract_cmd = p
            break

def is_tesseract_available() -> bool:
    return TESSERACT_EXECUTABLE is not None and os.path.exists(TESSERACT_EXECUTABLE)

# Initialize RapidOCR engine as high-performance backup
_rapid_ocr_engine = None
def get_rapid_ocr():
    global _rapid_ocr_engine
    if _rapid_ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _rapid_ocr_engine = RapidOCR()
        except Exception as e:
            logger.warning(f"Could not initialize RapidOCR fallback: {e}")
    return _rapid_ocr_engine

def detect_and_correct_skew(image: np.ndarray) -> Tuple[np.ndarray, float]:
    """
    Detect text orientation and skew angle using OpenCV and rotate to straighten text.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Invert and threshold to find text components
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]

    # Find coordinates of all foreground pixels
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 50:
        return image, 0.0

    # Minimum bounding rectangle
    angle = cv2.minAreaRect(coords)[-1]

    # Determine real angle from minAreaRect
    if angle < -45:
        angle = -(90 + angle)
    elif angle > 45:
        angle = -(angle - 90)
    else:
        angle = -angle

    # Only correct if skew is noticeable and realistic for scanner feed (-30 to +30)
    if abs(angle) > 0.5 and abs(angle) < 30.0:
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return rotated, float(angle)

    return image, 0.0

def preprocess_image_for_ocr(image_cv: np.ndarray) -> np.ndarray:
    """
    OpenCV preprocessing pipeline:
    1. Auto-rotate & de-skew
    2. Convert to single-channel Grayscale
    3. Denoise scanner noise
    4. Adaptive Contrast Enhancement (CLAHE)
    """
    # 1. Auto-rotate
    rotated, _ = detect_and_correct_skew(image_cv)

    # 2. Grayscale
    if len(rotated.shape) == 3:
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
    else:
        gray = rotated.copy()

    # 3. Denoise with median blur and fast denoising
    denoised = cv2.medianBlur(gray, 3)

    # 4. Contrast enhancement using CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast_enhanced = clahe.apply(denoised)

    return contrast_enhanced

def convert_pdf_page_to_cv2_image(doc: pymupdf.Document, page_num: int, dpi: int = 200) -> np.ndarray:
    """
    Render PDF page to a high-resolution OpenCV BGR image using PyMuPDF.
    """
    page = doc.load_page(page_num)
    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)

    # Convert bytes to numpy array
    img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
    if pix.n == 3:
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    elif pix.n == 1:
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)
    else:
        img_bgr = img_array
    return img_bgr

def run_tesseract_ocr(preprocessed_img: np.ndarray, lang: str = "eng+hin") -> Tuple[str, List[Dict[str, Any]], float]:
    """
    Execute Tesseract with Hindi + English models.
    Returns: (raw_text, words_with_bbox_and_confidence, average_confidence)
    """
    # Check if tesseract binary exists
    data = pytesseract.image_to_data(
        preprocessed_img,
        lang=lang,
        output_type=pytesseract.Output.DICT
    )

    words = []
    total_conf = 0.0
    valid_conf_count = 0
    raw_text_parts = []

    n_boxes = len(data["text"])
    for i in range(n_boxes):
        text = data["text"][i].strip()
        conf = float(data["conf"][i])

        if text and conf >= 0:
            words.append({
                "word": text,
                "confidence": round(conf, 2),
                "bbox": [
                    int(data["left"][i]),
                    int(data["top"][i]),
                    int(data["left"][i] + data["width"][i]),
                    int(data["top"][i] + data["height"][i])
                ]
            })
            total_conf += conf
            valid_conf_count += 1
            raw_text_parts.append(text)

    raw_text = " ".join(raw_text_parts)
    avg_conf = round(total_conf / valid_conf_count, 2) if valid_conf_count > 0 else 0.0

    return raw_text, words, avg_conf

def run_rapid_ocr_fallback(preprocessed_img: np.ndarray) -> Tuple[str, List[Dict[str, Any]], float]:
    """
    Execute RapidOCR as standalone onnx engine when Tesseract binary is not installed in the environment.
    """
    engine = get_rapid_ocr()
    if not engine:
        raise RuntimeError("Neither Tesseract nor RapidOCR is available in the current environment.")

    result, _ = engine(preprocessed_img)
    if not result:
        return "", [], 0.0

    words = []
    total_conf = 0.0
    raw_lines = []

    for item in result:
        # item is: [box_coordinates, text, confidence]
        box_coords, text, conf = item
        text_str = str(text).strip()
        conf_pct = round(float(conf) * 100.0, 2)

        # Convert 4-point polygon to [x0, y0, x1, y1]
        pts = np.array(box_coords)
        x0, y0 = int(np.min(pts[:, 0])), int(np.min(pts[:, 1]))
        x1, y1 = int(np.max(pts[:, 0])), int(np.max(pts[:, 1]))

        words.append({
            "word": text_str,
            "confidence": conf_pct,
            "bbox": [x0, y0, x1, y1]
        })
        total_conf += conf_pct
        raw_lines.append(text_str)

    raw_text = "\n".join(raw_lines)
    avg_conf = round(total_conf / len(words), 2) if words else 0.0

    return raw_text, words, avg_conf

def process_single_image(img_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Preprocess and extract OCR text from an image with Tesseract and automatic RapidOCR fallback.
    """
    preprocessed = preprocess_image_for_ocr(img_bgr)

    # 1. Attempt Tesseract with eng+hin if binary is present
    if is_tesseract_available():
        try:
            raw_text, words, avg_conf = run_tesseract_ocr(preprocessed, lang="eng+hin")
            if raw_text.strip():
                return {
                    "raw_text": raw_text,
                    "words": words,
                    "word_count": len(words),
                    "avg_confidence": avg_conf,
                    "engine": "tesseract"
                }
        except Exception as tess_err:
            logger.info(f"Tesseract failed ({tess_err}), falling back to on-device RapidOCR.")

    # 2. Fallback to RapidOCR
    raw_text, words, avg_conf = run_rapid_ocr_fallback(preprocessed)
    return {
        "raw_text": raw_text,
        "words": words,
        "word_count": len(words),
        "avg_confidence": avg_conf,
        "engine": "rapidocr"
    }

def process_document_ocr(file_path: str) -> List[Dict[str, Any]]:
    """
    Processes a land record document (PDF or image).
    Converts PDF pages to images using PyMuPDF, applies OpenCV preprocessing,
    runs OCR, and returns per-page text, word count, confidence, and bounding boxes.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Document file not found at path: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    pages_result = []

    if ext == ".pdf":
        doc = pymupdf.open(file_path)
        try:
            total_pages = len(doc)
            for page_idx in range(total_pages):
                img_bgr = convert_pdf_page_to_cv2_image(doc, page_idx, dpi=200)
                page_ocr = process_single_image(img_bgr)
                page_ocr["page_number"] = page_idx + 1

                # If scanned text was sparse, supplement with embedded vector text layer from PyMuPDF
                if page_ocr["word_count"] < 5:
                    page_fitz = doc.load_page(page_idx)
                    vec_text = page_fitz.get_text().strip()
                    if vec_text:
                        page_ocr["raw_text"] = (page_ocr["raw_text"] + "\n" + vec_text).strip()
                        page_ocr["word_count"] += len(vec_text.split())

                pages_result.append(page_ocr)
        finally:
            doc.close()

    elif ext in [".jpg", ".jpeg", ".png"]:
        img_bgr = cv2.imread(file_path)
        if img_bgr is None:
            # Fallback to PIL in case of special encoding
            pil_img = Image.open(file_path).convert("RGB")
            img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        page_ocr = process_single_image(img_bgr)
        page_ocr["page_number"] = 1
        pages_result.append(page_ocr)

    else:
        raise ValueError(f"Unsupported file format for OCR: {ext}. Accepted formats: PDF, JPG, PNG.")

    return pages_result

def extract_and_persist_document_ocr(db: Session, document: Document) -> Dict[str, Any]:
    """
    Runs the full OCR pipeline for a document, persists DocumentPage rows in the database,
    updates Document.raw_ocr_text and Document.status, and returns execution summary.
    """
    pages_data = process_document_ocr(document.file_path)

    # Delete existing pages if re-processing (idempotency)
    db.query(DocumentPage).filter(DocumentPage.document_id == document.id).delete()

    full_text_parts = []
    total_words = 0
    total_confidence = 0.0

    for p in pages_data:
        full_text_parts.append(p["raw_text"])
        total_words += p["word_count"]
        total_confidence += p.get("avg_confidence", 0.0)

        doc_page = DocumentPage(
            document_id=document.id,
            page_number=p["page_number"],
            raw_text=p["raw_text"],
            word_count=p["word_count"],
            avg_confidence=int(p.get("avg_confidence", 0)),
            ocr_metadata=json.dumps(p.get("words", []))
        )
        db.add(doc_page)

    full_text = "\n\n--- PAGE BREAK ---\n\n".join(full_text_parts)
    document.raw_ocr_text = full_text
    document.status = "done"
    document.processing_error = None

    # Offline QR parsing with allowlist check (zero outbound HTTP requests)
    try:
        from backend.app.services.qr_scanner import scan_and_parse_qr_data
        qr_results = scan_and_parse_qr_data(document.file_path, full_text)
        if qr_results:
            document.detected_qr_data = json.dumps(qr_results)
    except Exception as e:
        logger.warning(f"QR scanning encountered error: {e}")

    db.commit()
    db.refresh(document)

    avg_conf = round(total_confidence / len(pages_data), 2) if pages_data else 0.0

    return {
        "document_id": document.id,
        "status": document.status,
        "page_count": len(pages_data),
        "total_words": total_words,
        "avg_confidence": avg_conf,
        "raw_text_preview": full_text[:200]
    }
