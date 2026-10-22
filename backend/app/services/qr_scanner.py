import os
import re
import logging
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

from backend.app.config import settings

logger = logging.getLogger(__name__)

URL_REGEX = re.compile(
    r"https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)",
    re.IGNORECASE
)

def is_domain_allowlisted(url: str, allowlist: Optional[List[str]] = None) -> tuple[bool, str]:
    """
    Checks if the hostname in the URL matches the configured allowlist.
    Prevents SSRF and unauthorized redirect/external fetching.
    """
    allowed_domains = allowlist or settings.QR_ALLOWLIST_DOMAINS
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower().strip()
        if not hostname:
            return False, "Unknown / Empty Hostname"

        for domain in allowed_domains:
            clean_dom = domain.lower().strip()
            if hostname == clean_dom or hostname.endswith(f".{clean_dom}"):
                return True, hostname

        return False, hostname
    except Exception as e:
        logger.warning(f"Failed to parse URL {url}: {e}")
        return False, "Malformed URL"


def scan_and_parse_qr_data(file_path: str, raw_ocr_text: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Detects and parses QR codes and URLs from document pages.
    
    SECURITY GUARANTEE:
    - Pure offline parsing: NEVER makes outbound HTTP/HTTPS requests.
    - Evaluates URLs against departmental domain allowlist.
    """
    detected: List[Dict[str, Any]] = []
    seen_urls = set()

    # 1. Image-based QR code detection with OpenCV
    if file_path and os.path.exists(file_path):
        ext = os.path.splitext(file_path)[1].lower()
        images_to_scan: List[np.ndarray] = []

        try:
            if ext == ".pdf":
                import pymupdf
                doc = pymupdf.open(file_path)
                try:
                    # Scan first 3 pages
                    for page_idx in range(min(3, len(doc))):
                        page = doc.load_page(page_idx)
                        pix = page.get_pixmap(dpi=150)
                        img_arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                        if pix.n == 4:
                            img_arr = cv2.cvtColor(img_arr, cv2.COLOR_RGBA2BGR)
                        elif pix.n == 3:
                            img_arr = cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR)
                        images_to_scan.append(img_arr)
                finally:
                    doc.close()
            elif ext in [".jpg", ".jpeg", ".png"]:
                img = cv2.imread(file_path)
                if img is not None:
                    images_to_scan.append(img)

            detector = cv2.QRCodeDetector()
            for img in images_to_scan:
                try:
                    data, bbox, _ = detector.detectAndDecode(img)
                    if data and data.strip():
                        url_str = data.strip()
                        if url_str not in seen_urls:
                            seen_urls.add(url_str)
                            is_allowed, domain = is_domain_allowlisted(url_str)
                            detected.append({
                                "raw_url": url_str,
                                "domain": domain,
                                "is_allowed": is_allowed,
                                "source": "Optical QR Code Scan",
                                "status": "Allowlisted Official Domain" if is_allowed else "Unverified / Non-Whitelisted Domain",
                                "action_taken": "Parsed without outbound request (SSRF protection enforced)"
                            })
                except Exception as ex:
                    logger.debug(f"OpenCV QR decode step error: {ex}")

        except Exception as e:
            logger.warning(f"Error reading file for QR scanning: {e}")

    # 2. Text-based URL discovery from OCR text (if any)
    if raw_ocr_text:
        urls_in_text = URL_REGEX.findall(raw_ocr_text)
        for u in urls_in_text:
            u_clean = u.strip().rstrip(".,;)>]")
            if u_clean not in seen_urls:
                seen_urls.add(u_clean)
                is_allowed, domain = is_domain_allowlisted(u_clean)
                detected.append({
                    "raw_url": u_clean,
                    "domain": domain,
                    "is_allowed": is_allowed,
                    "source": "OCR Text Analysis",
                    "status": "Allowlisted Official Domain" if is_allowed else "Unverified / Non-Whitelisted Domain",
                    "action_taken": "Parsed without outbound request (SSRF protection enforced)"
                })

    return detected
