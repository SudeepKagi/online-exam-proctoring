"""
yolo_service.py — YOLOv8-nano object detection for ProctorNet proctoring.

Lab/Classroom Mode — smart zone-based detection:
  - Persons in CENTER zone (inner 55% of frame width) = PROXIMITY_ALERT
    → Someone leaning close to this student's screen (copying) — HIGH violation
  - Persons only in BACKGROUND zone = normal lab mates — silently logged, NOT a violation
  - Mobile phone present = PHONE_DETECTED (HIGH)
  - Book / notebook present = BOOK_DETECTED (MEDIUM)
  - Additional laptop = LAPTOP_DETECTED (HIGH)

COCO class IDs used:
  0  = person
  63 = laptop
  67 = cell phone
  73 = book
"""

import base64
import re
from io import BytesIO

from PIL import Image
import numpy as np

# ── Graceful import of ultralytics ────────────────────────────────────────────
YOLO_AVAILABLE = False
_model = None

try:
    from ultralytics import YOLO

    def _load_model():
        global _model, YOLO_AVAILABLE
        if _model is None:
            print("[YoloService] Loading YOLOv8n model (auto-downloads ~6MB on first run)…")
            _model = YOLO("yolov8n.pt")
            YOLO_AVAILABLE = True
            print("[YoloService] ✅ YOLOv8n model loaded successfully.")
        return _model

    try:
        _load_model()
    except Exception as _e:
        print(f"[YoloService Warning] Could not pre-load YOLO model: {_e}")

except ImportError:
    print("[YoloService Warning] ultralytics not installed — YOLO detection disabled. "
          "Run: pip install ultralytics==8.3.0")
    def _load_model():
        return None

# ── COCO class IDs ─────────────────────────────────────────────────────────────
_PERSON_ID  = 0
_LAPTOP_ID  = 63
_PHONE_ID   = 67
_BOOK_ID    = 73

# Confidence threshold — ignore weak detections
CONFIDENCE_THRESHOLD = 0.40

# ── Lab-mode zone thresholds ──────────────────────────────────────────────────
# The CENTER zone is the inner fraction of the frame.
# A person whose bbox center falls INSIDE this zone is considered close to the
# student's screen (leaning over = suspicious = PROXIMITY_ALERT).
# Persons entirely in the BACKGROUND zone = normal lab mates = silent log only.
CENTER_ZONE_X_FRACTION = 0.55  # inner 55% of frame width
CENTER_ZONE_Y_FRACTION = 0.70  # inner 70% of frame height


def _base64_to_pil(source: str) -> Image.Image:
    """Convert base64 data-URI or raw base64 string to a PIL Image (RGB)."""
    base64_data = re.sub(r'^data:image/[a-zA-Z]+;base64,', '', source)
    image_bytes = base64.b64decode(base64_data)
    return Image.open(BytesIO(image_bytes)).convert('RGB')


def _is_in_center_zone(cx: float, cy: float, frame_w: int, frame_h: int) -> bool:
    """
    Returns True if the bounding box center (cx, cy) is within the center zone.
    Center zone = inner CENTER_ZONE_X_FRACTION x CENTER_ZONE_Y_FRACTION of the frame.
    """
    x_margin = frame_w * (1 - CENTER_ZONE_X_FRACTION) / 2
    y_margin = frame_h * (1 - CENTER_ZONE_Y_FRACTION) / 2
    return (x_margin <= cx <= frame_w - x_margin and
            y_margin <= cy <= frame_h - y_margin)


def detect_objects(frame_base64: str) -> dict:
    """
    Run YOLOv8n inference — lab-aware, zone-based detection.

    Returns:
    {
        "success": bool,
        "yolo_available": bool,
        "persons": int,               — total persons in frame
        "background_persons": int,    — persons only in background (lab mates, not flagged)
        "proximity_alert": bool,      — someone leaning close to student's screen (flagged!)
        "phone_detected": bool,
        "book_detected": bool,
        "laptop_detected": bool,
        "detections": [               — all detections above threshold
            { "class_name", "confidence", "bbox", "zone" }
        ],
        "violations": [               — only real violations for this lab context
            "PROXIMITY_ALERT" | "PHONE_DETECTED" | "BOOK_DETECTED" | "LAPTOP_DETECTED"
        ],
        "error": str | None
    }
    """
    result = {
        "success": False,
        "yolo_available": YOLO_AVAILABLE,
        "persons": 0,
        "background_persons": 0,
        "proximity_alert": False,
        "phone_detected": False,
        "book_detected": False,
        "laptop_detected": False,
        "detections": [],
        "violations": [],
        "error": None,
    }

    if not YOLO_AVAILABLE or _model is None:
        result["error"] = "YOLO model not available. ultralytics not installed."
        return result

    try:
        img_pil = _base64_to_pil(frame_base64)
        img_pil = img_pil.resize((640, 480))
        frame_w, frame_h = img_pil.size
        img_np = np.array(img_pil)

        infer_results = _model(img_np, verbose=False, conf=CONFIDENCE_THRESHOLD)

        person_count     = 0
        background_count = 0
        proximity_alert  = False
        phone_detected   = False
        book_detected    = False
        laptop_detected  = False
        detections       = []

        for r in infer_results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls_id     = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                xyxy       = box.xyxy[0].tolist()   # [x1, y1, x2, y2]
                class_name = _model.names.get(cls_id, str(cls_id))

                if confidence < CONFIDENCE_THRESHOLD:
                    continue

                # Bounding box center for zone analysis
                center_x = (xyxy[0] + xyxy[2]) / 2.0
                center_y = (xyxy[1] + xyxy[3]) / 2.0
                in_center = _is_in_center_zone(center_x, center_y, frame_w, frame_h)
                zone = "center" if in_center else "background"

                detections.append({
                    "class_name": class_name,
                    "class_id": cls_id,
                    "confidence": round(confidence, 3),
                    "bbox": [round(v, 1) for v in xyxy],
                    "zone": zone,
                })

                if cls_id == _PERSON_ID:
                    person_count += 1
                    if in_center:
                        # Leaning over the student's screen → suspicious
                        proximity_alert = True
                    else:
                        # Background = normal lab mate → not flagged
                        background_count += 1

                elif cls_id == _PHONE_ID:
                    phone_detected = True
                elif cls_id == _BOOK_ID:
                    book_detected = True
                elif cls_id == _LAPTOP_ID:
                    laptop_detected = True

        # Lab-aware violations list:
        # ✅ PROXIMITY_ALERT  — someone leaning close (suspicious copying)
        # ✅ PHONE_DETECTED   — phone on student's desk
        # ✅ BOOK_DETECTED    — reference material
        # ✅ LAPTOP_DETECTED  — additional device
        # ❌ MULTIPLE_PERSONS — NOT flagged; background lab mates are normal
        violations = []
        if proximity_alert:
            violations.append("PROXIMITY_ALERT")
        if phone_detected:
            violations.append("PHONE_DETECTED")
        if book_detected:
            violations.append("BOOK_DETECTED")
        if laptop_detected:
            violations.append("LAPTOP_DETECTED")

        result.update({
            "success": True,
            "persons": person_count,
            "background_persons": background_count,
            "proximity_alert": proximity_alert,
            "phone_detected": phone_detected,
            "book_detected": book_detected,
            "laptop_detected": laptop_detected,
            "detections": detections,
            "violations": violations,
        })

    except Exception as e:
        result["error"] = str(e)
        print(f"[YoloService Error] detect_objects failed: {e}")

    return result
