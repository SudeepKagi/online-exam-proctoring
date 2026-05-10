import requests
import numpy as np
from io import BytesIO
from PIL import Image
import base64
import re

def download_image_as_numpy(source):
    if source.startswith('data:image'):
        # Extract base64 data
        base64_data = re.sub('^data:image/.+;base64,', '', source)
        image_data = base64.b64decode(base64_data)
        img = Image.open(BytesIO(image_data)).convert('RGB')
    else:
        response = requests.get(source)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content)).convert('RGB')
        
    return np.array(img)

def compare_faces(face_photo_url, id_card_photo_url):
    try:
        # Mocking face comparison to avoid dlib/tensorflow build issues on Windows Local Dev
        print("[FaceService] Simulating AI face comparison for local development...")
        
        # We simulate a delay
        import time
        time.sleep(1)

        return {
            "matchScore": 0.96,
            "distance": 0.04,
            "isMatch": True
        }

    except Exception as e:
        print(f"[FaceService Error] {str(e)}")
        return {"error": str(e)}

def verify_live_face(live_frame_url, registered_photo_url):
    res = compare_faces(live_frame_url, registered_photo_url)
    return res
