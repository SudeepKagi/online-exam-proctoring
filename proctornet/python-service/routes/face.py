from flask import Blueprint, request, jsonify
from services.face_service import crop_face_from_id, compare_face_embeddings

face_bp = Blueprint('face', __name__)

@face_bp.route('/crop-id-face', methods=['POST'])
def crop_id_face():
    data = request.json
    if not data or 'idCardPhotoUrl' not in data:
        return jsonify({"error": "Missing required field: idCardPhotoUrl"}), 400
    
    result = crop_face_from_id(data['idCardPhotoUrl'])
    return jsonify(result), 200 if result.get("success") else 400

@face_bp.route('/compare-faces', methods=['POST'])
def compare_faces():
    data = request.json
    if not data or 'liveFrame' not in data:
        return jsonify({"error": "Missing required field: liveFrame"}), 400
    
    result = compare_face_embeddings(data['liveFrame'], data.get('referenceUrl'))
    return jsonify(result), 200
