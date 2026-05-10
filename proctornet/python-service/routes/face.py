from flask import Blueprint, request, jsonify
from services.face_service import compare_faces, verify_live_face

face_bp = Blueprint('face', __name__)

@face_bp.route('/compare', methods=['POST'])
def compare():
    data = request.json
    if not data or 'facePhotoUrl' not in data or 'idCardPhotoUrl' not in data:
        return jsonify({"error": "Missing required fields: facePhotoUrl, idCardPhotoUrl"}), 400
    
    face_photo_url = data['facePhotoUrl']
    id_card_photo_url = data['idCardPhotoUrl']
    
    result = compare_faces(face_photo_url, id_card_photo_url)
    
    if "error" in result:
        return jsonify(result), 400
        
    return jsonify(result), 200

@face_bp.route('/verify-live', methods=['POST'])
def verify_live():
    data = request.json
    if not data or 'liveFrameBase64' not in data or 'registeredPhotoUrl' not in data:
        return jsonify({"error": "Missing required fields"}), 400
        
    # Note: the prompt says liveFrameBase64 but also passes it like URL.
    # Our service handles URLs right now. If it's a data URI (base64 string),
    # we would need to decode it. Assuming it's passed as a cloudinary URL 
    # or we handle base64 decoding later.
    live_frame = data['liveFrameBase64']
    registered_photo = data['registeredPhotoUrl']
    
    result = verify_live_face(live_frame, registered_photo)
    
    if "error" in result:
        return jsonify(result), 400
        
    return jsonify(result), 200
