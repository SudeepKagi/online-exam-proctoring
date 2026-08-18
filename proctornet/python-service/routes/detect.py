"""
detect.py — Flask Blueprint for YOLO object detection endpoint.

Routes:
  POST /api/detect/yolo   — Run YOLOv8n inference on a base64 webcam frame
  GET  /api/detect/status — Health check: is YOLO model loaded?
"""

from flask import Blueprint, request, jsonify
from services.yolo_service import detect_objects, YOLO_AVAILABLE

detect_bp = Blueprint('detect', __name__)


@detect_bp.route('/status', methods=['GET'])
def yolo_status():
    """Health check — confirms whether the YOLO model is loaded and ready."""
    return jsonify({
        "yolo_available": YOLO_AVAILABLE,
        "status": "ready" if YOLO_AVAILABLE else "unavailable",
        "message": (
            "YOLOv8n model loaded and ready for inference."
            if YOLO_AVAILABLE
            else "ultralytics not installed. Run: pip install ultralytics==8.3.0"
        )
    }), 200


@detect_bp.route('/yolo', methods=['POST'])
def yolo_detect():
    """
    Run YOLO object detection on a single webcam frame.

    Request body (JSON):
    {
        "frame": "<base64 data-URI or raw base64 string>"
    }

    Response (JSON):
    {
        "success": bool,
        "yolo_available": bool,
        "persons": int,
        "phone_detected": bool,
        "book_detected": bool,
        "laptop_detected": bool,
        "violations": ["MULTIPLE_PERSONS", "PHONE_DETECTED", ...],
        "detections": [ { "class_name", "confidence", "bbox" }, ... ],
        "error": str | null
    }
    """
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON.", "success": False}), 400

    frame = data.get('frame')
    if not frame:
        return jsonify({"error": "Missing required field: 'frame'", "success": False}), 400

    if not isinstance(frame, str) or len(frame) < 100:
        return jsonify({"error": "Invalid frame: must be a non-empty base64 string.", "success": False}), 400

    result = detect_objects(frame)

    status_code = 200 if result.get("success") else 500
    # Even on inference error, return 200 so the frontend doesn't crash the exam
    # (we never want a detection failure to block the exam)
    if not result.get("success") and result.get("yolo_available") is False:
        status_code = 200  # degraded mode — model missing but not a server error

    return jsonify(result), status_code
