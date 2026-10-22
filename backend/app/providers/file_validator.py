import hashlib
import os
import shutil
from typing import Tuple
from fastapi import UploadFile, HTTPException, status

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit
CHUNK_SIZE = 64 * 1024  # 64 KB

# Magic byte signatures
MAGIC_NUMBERS = {
    "application/pdf": b"%PDF-",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n"
}

def detect_mime_type(header: bytes) -> str | None:
    """Detect MIME type by inspecting real binary magic bytes."""
    if header.startswith(b"%PDF-"):
        return "application/pdf"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None

async def process_and_validate_upload(
    upload_file: UploadFile,
    target_dir: str,
    doc_id: str
) -> Tuple[str, str, int, str]:
    """
    Validates real MIME content (PDF, JPG, PNG only, ignoring spoofed extensions),
    enforces 10MB limit, computes SHA-256, and stores in target_dir outside public webroot.

    Returns: (stored_file_path, detected_mime_type, file_size_bytes, sha256_hash)
    """
    os.makedirs(target_dir, exist_ok=True)
    temp_target_path = os.path.join(target_dir, f"{doc_id}_upload.tmp")
    sha256 = hashlib.sha256()
    total_size = 0
    detected_mime = None

    try:
        # Read the first chunk to inspect magic bytes
        first_chunk = await upload_file.read(CHUNK_SIZE)
        if not first_chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )

        detected_mime = detect_mime_type(first_chunk)
        if not detected_mime:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Only valid PDF, JPEG, and PNG files with matching binary signatures are accepted."
            )

        with open(temp_target_path, "wb") as f:
            f.write(first_chunk)
            sha256.update(first_chunk)
            total_size += len(first_chunk)

            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
                )

            # Read remaining chunks
            while True:
                chunk = await upload_file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
                    )
                f.write(chunk)
                sha256.update(chunk)

        # Extension based on verified MIME
        extension_map = {
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/png": ".png"
        }
        final_filename = f"{doc_id}{extension_map[detected_mime]}"
        final_path = os.path.join(target_dir, final_filename)
        shutil.move(temp_target_path, final_path)

        return final_path, detected_mime, total_size, sha256.hexdigest()

    except Exception:
        # Clean up temporary file on failure
        if os.path.exists(temp_target_path):
            try:
                os.remove(temp_target_path)
            except OSError:
                pass
        raise
