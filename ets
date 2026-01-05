# app.py - WORKING FOR NOVEMBER 2025 (Gemini 2.0+)
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests
import traceback

load_dotenv()

app = Flask(__name__)
CORS(app)

# CRITICAL: Use v1beta and Gemini 2.0 Flash (1.5 is deprecated)
# GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# New endpoint to list available models (as per error message)
@app.route('/list-models', methods=['GET'])
def list_models():
    """Fetch available Gemini models from API"""
    if not GEMINI_API_KEY:
        return jsonify({"error": "API key missing"}), 400
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            models = response.json().get('models', [])
            model_names = [model['name'].split('/')[-1] for model in models if 'generateContent' in model.get('supportedGenerationMethods', [])]
            return jsonify({
                "available_models": model_names,
                "recommended": ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3-pro-preview"]
            })
        else:
            return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def call_gemini_api(prompt):
    """Call Gemini API - Updated for 2025 (v1beta, Gemini 2.0+)"""
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set!")
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192
        }
    }

    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120
        )

        print(f"Gemini Status: {response.status_code} - {response.text[:200]}...")  # Debug log

        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and result['candidates']:
                return result["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print(f"API Error: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        print("Exception in call_gemini_api:", e)
        print(traceback.format_exc())
        return None


@app.route('/test-gemini', methods=['GET'])
def test_gemini():
    """Test endpoint - Now uses Gemini 2.0"""
    result = call_gemini_api("Say 'Gemini 2.0 is working perfectly in 2025!' in bold.")
    return jsonify({
        "working": result is not None,
        "response": result or "Failed - check server logs"
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'success',
        'message': 'Backend running on Gemini 2.0!',
        'api_key_set': bool(GEMINI_API_KEY)
    }), 200


@app.route('/api/detect-framework', methods=['POST'])
def detect_framework():
    try:
        data = request.json or {}
        filename = data.get('filename', '')

        ext = filename.split('.')[-1].lower() if '.' in filename else ''

        framework_map = {
            'js': 'Jest', 'jsx': 'Jest', 'ts': 'Jest', 'tsx': 'Jest',
            'py': 'pytest', 'java': 'JUnit'
        }
        language_map = {
            'js': 'JavaScript', 'jsx': 'JavaScript',
            'ts': 'TypeScript', 'tsx': 'TypeScript',
            'py': 'Python', 'java': 'Java'
        }
        available = {
            'JavaScript': ['Jest', 'Mocha', 'Vitest'],
            'TypeScript': ['Jest', 'Mocha', 'Vitest'],
            'Python': ['pytest', 'unittest'],
            'Java': ['JUnit', 'TestNG']
        }

        language = language_map.get(ext, 'JavaScript')
        framework = framework_map.get(ext, 'Jest')

        return jsonify({
            'status': 'success',
            'framework': framework,
            'language': language,
            'extension': ext,
            'availableFrameworks': available.get(language, [])
        }), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/generate-tests', methods=['POST'])
def generate_tests():
    print("\n=== Generating Tests with Gemini 2.0 ===")
    try:
        if not GEMINI_API_KEY:
            return jsonify({
                'status': 'error',
                'message': 'GEMINI_API_KEY not set in .env!'
            }), 500

        data = request.json or {}
        source_code = data.get('code', '').strip()
        language = data.get('language', 'JavaScript')
        framework = data.get('framework', 'Jest')
        coverage_target = data.get('coverageTarget', 80)

        if not source_code:
            return jsonify({
                'status': 'error',
                'message': 'No source code provided'
            }), 400

        prompt = f"""You are an expert test engineer. Generate comprehensive unit tests for the following {language} code using {framework}.

**Requirements:**
- Target {coverage_target}% code coverage
- Test each function/method thoroughly
- Include edge cases, error scenarios, boundary conditions
- Use proper {framework} syntax and best practices
- Add descriptive test names (e.g., 'should handle valid input correctly')
- Include setup/teardown if needed

**Source Code:**
```{language.lower()}
{source_code}