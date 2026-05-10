import requests
import numpy as np
from io import BytesIO
from PIL import Image
import base64
import re

# Conditional imports for local development portability
try:
    import face_recognition
    HAS_FACE_AI = True
except ImportError:
    HAS_FACE_AI = False
    print("[FaceService Warning] face_recognition library not found. Using Mock AI fallback.")

def download_image_as_numpy(source):
    try:
        if source.startswith('data:image'):
            base64_data = re.sub('^data:image/.+;base64,', '', source)
            image_data = base64.b64decode(base64_data)
            img = Image.open(BytesIO(image_data)).convert('RGB')
        else:
            response = requests.get(source, timeout=10)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content)).convert('RGB')
            
        return np.array(img)
    except Exception as e:
        print(f"[download_image_as_numpy Error] {str(e)}")
        raise e

def compare_faces(face_photo_url, id_card_photo_url):
    if not HAS_FACE_AI:
        # High-fidelity mock for local demonstration
        import time
        time.sleep(0.5)
        return {
            "matchScore": 0.92,
            "distance": 0.08,
            "isMatch": True,
            "warning": "Library missing: Using Mock AI Fallback"
        }

    try:
        img1 = download_image_as_numpy(face_photo_url)
        img2 = download_image_as_numpy(id_card_photo_url)

        enc1 = face_recognition.face_encodings(img1)
        enc2 = face_recognition.face_encodings(img2)

        if not enc1 or not enc2:
            return {
                "matchScore": 0.0,
                "isMatch": False,
                "error": "Could not detect a face in one of the images."
            }

        distance = face_recognition.face_distance([enc1[0]], enc2[0])[0]
        match_score = max(0, 1 - distance)
        
        return {
            "matchScore": float(match_score),
            "distance": float(distance),
            "isMatch": bool(distance < 0.6)
        }

    except Exception as e:
        print(f"[FaceService Error] {str(e)}")
        return {"error": str(e)}

def verify_live_face(live_frame_url, registered_photo_url):
    return compare_faces(live_frame_url, registered_photo_url)
