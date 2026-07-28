import re
import requests
from io import BytesIO
from PIL import Image

try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("[OCR Service Warning] pytesseract not found. Using Mock OCR fallback.")

def extract_usn_from_text(text):
    # Regex to match VTU USN format, e.g., 1BM21CS045 or 1VE22CS001
    pattern = r'[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}'
    match = re.search(pattern, text.upper())
    if match:
        return match.group(0)
    return None

def verify_id_card(id_card_url):
    if not HAS_OCR:
        return {
            "isValid": False,
            "extractedUsn": None,
            "error": "pytesseract library not installed on python service"
        }

    try:
        # Download image
        response = requests.get(id_card_url, timeout=10)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))

        # Perform OCR
        raw_text = pytesseract.image_to_string(img)
        
        # Extract USN
        usn = extract_usn_from_text(raw_text)
        
        return {
            "isValid": usn is not None,
            "extractedUsn": usn,
            "extractedName": None,
            "rawText": raw_text
        }
        
    except Exception as e:
        print(f"[OCR Service Error] {str(e)}")
        return {
            "isValid": False,
            "extractedUsn": None,
            "error": f"Tesseract OCR processing failed: {str(e)}"
        }
