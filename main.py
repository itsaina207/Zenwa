import os
from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='public')

@app.route('/')
def index():
    """Serve the landing page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Serve static files"""
    return send_from_directory(app.static_folder, path)

@app.route('/health')
def health():
    """Health check endpoint"""
    return {"status": "ok", "version": "1.0.0"}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))