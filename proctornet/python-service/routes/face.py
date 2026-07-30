from flask import Blueprint, request, jsonify
from services.face_service import crop_face_from_id, check_liveness_anti_spoofing

face_bp = Blueprint('face', __name__)

@face_bp.route('/crop-id-face', methods=['POST'])
def crop_id_face():
    data = request.json
    if not data or 'idCardPhotoUrl' not in data:
        return jsonify({"error": "Missing required field: idCardPhotoUrl"}), 400
    
    result = crop_face_from_id(data['idCardPhotoUrl'])
    return jsonify(result), 200 if result.get("success") else 400

@face_bp.route('/liveness-check', methods=['POST'])
def liveness_check():
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"error": "Missing required field: image"}), 400
    
    result = check_liveness_anti_spoofing(data['image'])
    return jsonify(result), 200
