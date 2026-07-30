import re
import requests
from io import BytesIO
from PIL import Image
import numpy as np

import importlib

# Try PaddleOCR, fallback to Pytesseract
PADDLE_AVAILABLE = False
PYTESSERACT_AVAILABLE = False
ocr_engine = None

try:
    paddle_mod = importlib.import_module('paddleocr') # type: ignore
    PaddleOCR = getattr(paddle_mod, 'PaddleOCR')
    ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    PADDLE_AVAILABLE = True
    print("[OCR Service] PaddleOCR initialized successfully.")
except Exception as e:
    print(f"[OCR Service Warning] PaddleOCR module not loaded ({str(e)}). Checking Pytesseract fallback...")
    try:
        pyt_mod = importlib.import_module('pytesseract') # type: ignore
        PYTESSERACT_AVAILABLE = True
        print("[OCR Service] Pytesseract fallback available.")
    except Exception as e_pyt:
        print(f"[OCR Service Warning] Pytesseract unavailable ({str(e_pyt)}). Mock OCR mode active.")

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
        if id_card_url.startswith('data:image'):
            import base64
            base64_data = re.sub('^data:image/.+;base64,', '', id_card_url)
            image_bytes = base64.b64decode(base64_data)
            img = Image.open(BytesIO(image_bytes)).convert('RGB')
        else:
            response = requests.get(id_card_url, timeout=10)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content)).convert('RGB')

        raw_text = ""

        if PADDLE_AVAILABLE:
            img_np = np.array(img)
            result = ocr_engine.ocr(img_np, cls=True)
            if result and result[0]:
                raw_text = "\n".join([line[1][0] for line in result[0]])
        elif PYTESSERACT_AVAILABLE:
            import pytesseract
            raw_text = pytesseract.image_to_string(img)
        else:
            # Mock OCR text for development testing when binaries aren't installed locally
            raw_text = f"NAME: Candidate Student\nUSN: 1MS21CS001\nDOB: 15/08/2002\nINSTITUTE OF TECHNOLOGY"

        usn = extract_usn_from_text(raw_text)
        name = extract_name_from_text(raw_text)
        dob = extract_dob_from_text(raw_text)

        return {
            "isValid": True,
            "extractedUsn": usn,
            "extractedName": name,
            "extractedDob": dob,
            "rawText": raw_text,
            "ocrEngineUsed": "PaddleOCR" if PADDLE_AVAILABLE else ("Pytesseract" if PYTESSERACT_AVAILABLE else "MockFallback")
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
