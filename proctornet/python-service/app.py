from flask import Flask, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

from routes.face import face_bp
from routes.ocr import ocr_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(face_bp, url_prefix='/api/face')
app.register_blueprint(ocr_bp, url_prefix='/api/ocr')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'Python microservice is running',
        'service': 'ProctorNet AI Engine'
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
