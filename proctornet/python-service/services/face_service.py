import face_recognition
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
        # 1. Download images
        face_image = download_image_as_numpy(face_photo_url)
        id_card_image = download_image_as_numpy(id_card_photo_url)

        # 2. Find face encodings
        face_encodings = face_recognition.face_encodings(face_image)
        id_card_encodings = face_recognition.face_encodings(id_card_image)

        # Ensure faces were found in both images
        if len(face_encodings) == 0:
            return {"error": "No face found in the provided face photo."}
        if len(id_card_encodings) == 0:
            return {"error": "No face found in the provided ID card photo."}

        # 3. Use the first face found in each image
        face_encoding = face_encodings[0]
        id_card_encoding = id_card_encodings[0]

        # 4. Calculate distance
        distance = face_recognition.face_distance([id_card_encoding], face_encoding)[0]
        
        # 5. Calculate match score
        # Using a non-linear mapping or simple 1 - distance. We'll use 1 - distance for simplicity
        # where distance 0.0 means perfect match (1.0 score), distance 1.0 means opposite (0.0 score)
        match_score = max(0.0, 1.0 - distance)

        return {
            "matchScore": float(match_score),
            "distance": float(distance)
        }

    except Exception as e:
        print(f"[FaceService Error] {str(e)}")
        return {"error": str(e)}

def verify_live_face(live_frame_url, registered_photo_url):
    # For Step 50 / live verification
    res = compare_faces(live_frame_url, registered_photo_url)
    if "error" in res:
        return res
    
    # Standard threshold in face_recognition is 0.6 distance (which is 0.4 score)
    # The application uses score > 0.8 as strong match generally, or we return distance
    is_match = res["distance"] < 0.6
    res["isMatch"] = bool(is_match)
    return res
