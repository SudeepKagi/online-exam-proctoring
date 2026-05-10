from flask import Blueprint, request, jsonify
from services.ocr_service import verify_id_card

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/verify-id', methods=['POST'])
def verify_id():
    data = request.json
    if not data or 'idCardUrl' not in data:
        return jsonify({"error": "Missing required field: idCardUrl"}), 400
        
    id_card_url = data['idCardUrl']
    
    result = verify_id_card(id_card_url)
    
    if "error" in result:
        return jsonify(result), 400
        
    return jsonify(result), 200
