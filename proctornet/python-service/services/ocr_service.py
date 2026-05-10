import pytesseract
from PIL import Image
import re
from services.face_service import download_image_as_numpy

def extract_usn_from_text(text):
    # Regex to match VTU USN format, e.g., 1BM21CS045 or 1VE22CS001
    # Format: 1 digit, 2 letters, 2 digits, 2 letters, 3 digits
    pattern = r'[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}'
    match = re.search(pattern, text.upper())
    if match:
        return match.group(0)
    return None

def verify_id_card(id_card_url):
    try:
        # Download image
        id_card_numpy = download_image_as_numpy(id_card_url)
        img = Image.fromarray(id_card_numpy)
        
        # Perform OCR
        # Note: You might need to add psm options depending on the card layout
        custom_config = r'--oem 3 --psm 6'
        extracted_text = pytesseract.image_to_string(img, config=custom_config)
        
        # Extract USN
        extracted_usn = extract_usn_from_text(extracted_text)
        
        # For extracting the name, it's highly dependent on the ID card layout.
        # Here we just use a basic approach of taking lines that might be a name.
        # We will return the first 3 lines just in case, but usually a robust
        # parsing or specific region extraction is needed.
        lines = [line.strip() for line in extracted_text.split('\n') if len(line.strip()) > 3]
        extracted_name = lines[1] if len(lines) > 1 else (lines[0] if len(lines) > 0 else "")
        
        return {
            "isValid": bool(extracted_usn),
            "extractedUsn": extracted_usn,
            "extractedName": extracted_name,
            "rawText": extracted_text # for debugging
        }
        
    except Exception as e:
        print(f"[OCR Service Error] {str(e)}")
        return {"error": str(e)}
