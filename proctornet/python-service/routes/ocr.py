import os
from flask import Blueprint, request, jsonify
from services.ocr_service import verify_id_card

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/verify-id', methods=['POST'])
def verify_id():
    # Enforce internal service authentication if configured
    internal_key = os.environ.get('INTERNAL_SERVICE_KEY')
    if internal_key:
        token = request.headers.get('X-Internal-Token') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if token != internal_key:
            return jsonify({"error": "Unauthorized: invalid or missing internal service token"}), 401

    data = request.json
    if not data or 'idCardUrl' not in data:
        return jsonify({"error": "Missing required field: idCardUrl"}), 400

    id_card_url = data['idCardUrl']
    if not isinstance(id_card_url, str) or not id_card_url.strip():
        return jsonify({"error": "Field idCardUrl must be a non-empty string"}), 400

    result = verify_id_card(id_card_url)

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result), 200
