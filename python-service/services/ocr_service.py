import os
import re
import socket
import ipaddress
import urllib.parse
import requests
from io import BytesIO
from PIL import Image
import numpy as np
import importlib

# Maximum allowed image size (5 MB) and maximum pixel count (10 megapixels) to prevent decompression bombs
MAX_IMAGE_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 10_000_000

# Try PaddleOCR, fallback to Pytesseract
PADDLE_AVAILABLE = False
PYTESSERACT_AVAILABLE = False
ocr_engine = None

try:
    paddle_mod = importlib.import_module('paddleocr')  # type: ignore
    PaddleOCR = getattr(paddle_mod, 'PaddleOCR')
    ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    PADDLE_AVAILABLE = True
    print("[OCR Service] PaddleOCR initialized successfully.")
except Exception as e:
    print(f"[OCR Service Warning] PaddleOCR module not loaded ({str(e)}). Checking Pytesseract fallback...")
    try:
        pyt_mod = importlib.import_module('pytesseract')  # type: ignore
        PYTESSERACT_AVAILABLE = True
        print("[OCR Service] Pytesseract fallback available.")
    except Exception as e_pyt:
        print(f"[OCR Service Warning] Neither PaddleOCR nor Pytesseract is available ({str(e_pyt)}). OCR verification will reject until an engine is installed.")


def is_safe_url(url: str) -> bool:
    """
    Validates URL to mitigate SSRF:
    - Enforces HTTP or HTTPS protocol
    - Resolves DNS and blocks loopback, private, link-local, and reserved IP ranges
    - Enforces allowed domain suffix (S3 / ProctorNet endpoints)
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    # Block well-known cloud metadata hostnames directly
    if hostname.lower() in ('169.254.169.254', 'metadata.google.internal', 'instance-data', 'localhost'):
        return False

    # Check allowed domain whitelist if configured or default to AWS S3 & production domains
    allowed_domains_env = os.environ.get('ALLOWED_MEDIA_DOMAINS', '')
    if allowed_domains_env:
        allowed_domains = [d.strip().lower() for d in allowed_domains_env.split(',') if d.strip()]
        if not any(hostname.lower() == d or hostname.lower().endswith('.' + d) for d in allowed_domains):
            return False
    else:
        # Default policy: AWS S3 endpoints and proctornet domain
        valid_suffixes = ('.amazonaws.com', 'amazonaws.com', '.duckdns.org', 'duckdns.org')
        if not any(hostname.lower() == s or hostname.lower().endswith(s) for s in valid_suffixes):
            return False

    # Resolve hostname to IPs and verify none fall into dangerous ranges
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            ):
                return False
    except Exception:
        return False

    return True


def safe_fetch_image(url: str) -> Image.Image:
    """
    Safely fetches image bytes while blocking SSRF, enforcing size limits,
    MIME types, and image decompression boundaries.
    """
    if url.startswith('data:image'):
        import base64
        base64_data = re.sub('^data:image/[a-zA-Z0-9.+_-]+;base64,', '', url)
        image_bytes = base64.b64decode(base64_data)
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError(f"Base64 image size exceeds maximum permitted {MAX_IMAGE_BYTES} bytes")
        img = Image.open(BytesIO(image_bytes)).convert('RGB')
        return img

    if not is_safe_url(url):
        raise ValueError("URL rejected: Address must belong to an approved media domain and cannot resolve to a private or loopback IP.")

    # Strict no-redirect request with timeout and streaming
    with requests.get(url, timeout=10, stream=True, allow_redirects=False) as response:
        if response.status_code != 200:
            raise ValueError(f"Upstream image fetch failed with HTTP status {response.status_code}")

        content_type = response.headers.get('Content-Type', '').lower()
        if not content_type.startswith('image/'):
            raise ValueError(f"Invalid content type: '{content_type}'. Only images are accepted.")

        content = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            content.extend(chunk)
            if len(content) > MAX_IMAGE_BYTES:
                raise ValueError(f"Remote image exceeds maximum limit of {MAX_IMAGE_BYTES} bytes")

        img = Image.open(BytesIO(content)).convert('RGB')
        return img


def extract_usn_from_text(text):
    # Regex to match USN / Roll No / Employee ID patterns
    # e.g., 1BM21CS045, 1MS21CS001, EMP102, 2026CS101
    pattern = r'([1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}|EMP[0-9]{3,6}|[0-9]{4}[A-Z]{2,4}[0-9]{3,5})'
    match = re.search(pattern, text.upper())
    if match:
        return match.group(0)
    return None


def extract_name_from_text(text):
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        if any(keyword in line.lower() for keyword in ['name', 'student name', 'candidate name', 'holder']):
            parts = line.split(':')
            if len(parts) > 1:
                return parts[1].strip()
        # Fallback to uppercase 2-3 word line
        words = line.split()
        if 2 <= len(words) <= 4 and all(w.isalpha() for w in words) and line.isupper():
            if not any(k in line for k in ['COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'IDENTITY', 'CARD']):
                return line
    return None


def extract_dob_from_text(text):
    pattern = r'(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})'
    match = re.search(pattern, text)
    if match:
        return match.group(0)
    return None


def verify_id_card(id_card_url):
    try:
        img = safe_fetch_image(id_card_url)
        raw_text = ""

        if PADDLE_AVAILABLE and ocr_engine is not None:
            img_np = np.array(img)
            result = ocr_engine.ocr(img_np, cls=True)
            if result and result[0]:
                raw_text = "\n".join([line[1][0] for line in result[0]])
        elif PYTESSERACT_AVAILABLE:
            try:
                import pytesseract
                raw_text = pytesseract.image_to_string(img)
            except Exception as e_pyt:
                raise RuntimeError(f"Pytesseract OCR failed to process image: {str(e_pyt)}")
        else:
            raise RuntimeError(
                "No OCR engine is active or available on this host. ID card cannot be verified without PaddleOCR or Pytesseract installed."
            )

        usn = extract_usn_from_text(raw_text)
        name = extract_name_from_text(raw_text)
        dob = extract_dob_from_text(raw_text)

        # Genuine extraction determination: require at least a recognized USN or Candidate Name
        is_valid = bool(usn or name)

        return {
            "isValid": is_valid,
            "extractedUsn": usn,
            "extractedName": name,
            "extractedDob": dob,
            "rawText": raw_text if is_valid else "",
            "ocrEngineUsed": "PaddleOCR" if PADDLE_AVAILABLE else "Pytesseract"
        }

    except Exception as e:
        print(f"[OCR Service Error] {str(e)}")
        return {
            "isValid": False,
            "extractedUsn": None,
            "extractedName": None,
            "extractedDob": None,
            "error": f"OCR processing failed: {str(e)}"
        }
