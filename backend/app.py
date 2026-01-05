# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import os
# from dotenv import load_dotenv
# import json
# import traceback
# import requests

# # Load environment variables
# load_dotenv()

# # Initialize Flask app
# app = Flask(__name__)

# # ==============================
# # CORS Configuration - FIXED
# # ==============================
# CORS(app, resources={
#     r"/api/*": {
#         "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type", "Authorization"],
#         "supports_credentials": True
#     }
# })

# # Alternative: Allow all origins (for development only)
# # CORS(app, origins="*")

# # ==============================
# # Groq API Configuration
# # ==============================
# GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# GROQ_MODELS = {
#     "llama-3.3-70b": "llama-3.3-70b-versatile",
#     "llama-3.1-8b": "llama-3.1-8b-instant",
#     "mixtral-8x7b": "mixtral-8x7b-32768",
#     "gemma2-9b": "gemma2-9b-it",
# }

# DEFAULT_MODEL = GROQ_MODELS["llama-3.3-70b"]


# # ==============================
# # Groq API Call
# # ==============================
# def call_groq_api(prompt, model=None, max_tokens=4096):
#     if not GROQ_API_KEY:
#         print("ERROR: GROQ_API_KEY not set!")
#         return None

#     model = model or DEFAULT_MODEL

#     payload = {
#         "model": model,
#         "messages": [
#             {
#                 "role": "system",
#                 "content": "You are an expert software test engineer who writes comprehensive unit tests."
#             },
#             {
#                 "role": "user",
#                 "content": prompt
#             }
#         ],
#         "temperature": 0.2,
#         "max_tokens": max_tokens,
#         "top_p": 0.9
#     }

#     try:
#         response = requests.post(
#             GROQ_API_URL,
#             json=payload,
#             headers={
#                 "Authorization": f"Bearer {GROQ_API_KEY}",
#                 "Content-Type": "application/json"
#             },
#             timeout=60
#         )

#         if response.status_code != 200:
#             print("Groq API error:", response.text)
#             return None

#         data = response.json()
#         return data["choices"][0]["message"]["content"]

#     except Exception:
#         print(traceback.format_exc())
#         return None


# # ==============================
# # Health Endpoints
# # ==============================
# @app.route("/api/health", methods=["GET"])
# def health_check():
#     return jsonify({
#         "status": "success",
#         "api_key_set": bool(GROQ_API_KEY),
#         "model": DEFAULT_MODEL
#     })


# @app.route("/test-llm", methods=["GET"])
# def test_llm():
#     response = call_groq_api("Say 'Groq is working perfectly!'", max_tokens=30)
#     return jsonify({
#         "working": response is not None,
#         "response": response
#     })


# # ==============================
# # Framework Detection - FIXED
# # ==============================
# @app.route("/api/detect-framework", methods=["POST", "OPTIONS"])
# def detect_framework():
#     # Handle preflight OPTIONS request
#     if request.method == "OPTIONS":
#         return jsonify({"status": "ok"}), 200
    
#     data = request.json or {}
#     filename = data.get("filename", "")
    
#     print(f"🔍 Detecting framework for: {filename}")  # Debug log
    
#     ext = filename.split(".")[-1].lower()

#     # Map extensions to frameworks
#     framework_map = {
#         "js": "Jest", "jsx": "Jest",
#         "ts": "Jest", "tsx": "Jest",
#         "py": "pytest",
#         "java": "JUnit"
#     }

#     # Map extensions to languages
#     language_map = {
#         "js": "JavaScript", "jsx": "JavaScript",
#         "ts": "TypeScript", "tsx": "TypeScript",
#         "py": "Python",
#         "java": "Java"
#     }

#     # Available frameworks for each language
#     available_frameworks_map = {
#         "JavaScript": ["Jest", "Mocha", "Jasmine"],
#         "TypeScript": ["Jest", "Mocha", "Jasmine"],
#         "Python": ["pytest", "unittest", "nose2"],
#         "Java": ["JUnit", "TestNG", "Spock"]
#     }

#     detected_language = language_map.get(ext, "JavaScript")
#     detected_framework = framework_map.get(ext, "Jest")
#     available = available_frameworks_map.get(detected_language, [detected_framework])

#     result = {
#         "status": "success",
#         "framework": detected_framework,
#         "language": detected_language,
#         "extension": ext,
#         "availableFrameworks": available
#     }
    
#     print(f"✅ Detection result: {result}")  # Debug log
    
#     return jsonify(result)


# # ==============================
# # Generate Tests
# # ==============================
# @app.route("/api/generate-tests", methods=["POST", "OPTIONS"])
# def generate_tests():
#     if request.method == "OPTIONS":
#         return jsonify({"status": "ok"}), 200
        
#     try:
#         data = request.json or {}
#         source_code = data.get("code", "").strip()
#         language = data.get("language", "JavaScript")
#         framework = data.get("framework", "Jest")
#         coverage = data.get("coverageTarget", 80)

#         if not source_code:
#             return jsonify({"status": "error", "message": "No source code provided"}), 400

#         print(f"🤖 Generating tests: {language}/{framework}, coverage: {coverage}%")

#         prompt = f"""
# Generate unit tests using {framework}.

# Language: {language}
# Target Coverage: {coverage}%

# Source Code:
# {source_code}

# Return ONLY test code. No markdown. No explanation.
# """

#         tests = call_groq_api(prompt)

#         if not tests:
#             return jsonify({"status": "error", "message": "LLM failed"}), 500

#         return jsonify({
#             "status": "success",
#             "tests": tests.strip()
#         })

#     except Exception as e:
#         print(traceback.format_exc())
#         return jsonify({"status": "error", "message": str(e)}), 500


# # ==============================
# # Fix Tests
# # ==============================
# @app.route("/api/fix-tests", methods=["POST", "OPTIONS"])
# def fix_tests():
#     if request.method == "OPTIONS":
#         return jsonify({"status": "ok"}), 200
        
#     try:
#         data = request.json or {}
#         test_code = data.get("testCode", "")
#         error_message = data.get("errorMessage", "")
#         source_code = data.get("sourceCode", "")
#         framework = data.get("framework", "Jest")
#         language = data.get("language", "JavaScript")

#         prompt = f"""
# Fix the following failing tests.

# Framework: {framework}
# Language: {language}

# Source Code:
# {source_code}

# Test Code:
# {test_code}

# Error:
# {error_message}

# Return ONLY fixed test code.
# """

#         fixed = call_groq_api(prompt)

#         if not fixed:
#             return jsonify({"status": "error", "message": "Fix failed"}), 500

#         return jsonify({
#             "status": "success",
#             "fixedTests": fixed.strip()
#         })

#     except Exception as e:
#         print(traceback.format_exc())
#         return jsonify({"status": "error", "message": str(e)}), 500


# # ==============================
# # Coverage Report
# # ==============================
# @app.route("/api/get-coverage-report", methods=["POST", "OPTIONS"])
# def get_coverage_report():
#     if request.method == "OPTIONS":
#         return jsonify({"status": "ok"}), 200
        
#     try:
#         data = request.json or {}
#         language = data.get("language", "JavaScript")
#         framework = data.get("framework", "Jest")

#         return jsonify({
#             "status": "success",
#             "coverageReport": {
#                 "totalCoverage": 72,
#                 "runCommand": "npx jest --coverage" if framework == "Jest" else "pytest --cov",
#                 "missingLines": "15-20, 35, 50-60",
#                 "suggestions": [
#                     "Add edge case tests",
#                     "Cover error branches"
#                 ]
#             }
#         })

#     except Exception as e:
#         print(traceback.format_exc())
#         return jsonify({"status": "error", "message": str(e)}), 500


# # ==============================
# # Server Startup
# # ==============================
# if __name__ == "__main__":
#     port = int(os.getenv("FLASK_PORT", 5000))
#     print("🚀 Flask server running on port", port)
#     print("✅ CORS enabled for http://localhost:5173")
#     app.run(host="0.0.0.0", port=port, debug=True)


from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import json
import traceback
import requests
import subprocess
import tempfile
import shutil
import re
import sys

load_dotenv()

app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEFAULT_MODEL = "llama-3.3-70b-versatile"
MAX_ITERATIONS = 3


def call_groq_api(prompt, model=None, max_tokens=4096):
    if not GROQ_API_KEY:
        print("ERROR: GROQ_API_KEY not set!")
        return None

    model = model or DEFAULT_MODEL
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an expert software test engineer who writes comprehensive unit tests."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        "top_p": 0.9
    }

    try:
        response = requests.post(
            GROQ_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            timeout=60
        )
        if response.status_code != 200:
            print("Groq API error:", response.text)
            return None
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Groq API Exception: {e}")
        print(traceback.format_exc())
        return None


def extract_code_from_markdown(text):
    """Remove markdown code fences"""
    text = re.sub(r'^```[\w]*\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n```$', '', text, flags=re.MULTILINE)
    text = text.strip()
    
    if text.startswith('```') and text.endswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1])
    
    return text


def fix_imports_in_test_code(test_code, correct_module_name):
    """Fix common import mistakes"""
    wrong_patterns = [
        r'from your_module import',
        r'from module import',
        r'from source import',
        r'from app import',
        r'from main import',
        r'import your_module',
        r'import module',
    ]
    
    for pattern in wrong_patterns:
        test_code = re.sub(pattern, f'from {correct_module_name} import', test_code, flags=re.IGNORECASE)
    
    if f'from {correct_module_name} import' not in test_code and f'import {correct_module_name}' not in test_code:
        lines = test_code.split('\n')
        import_index = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import ') or line.strip().startswith('from '):
                import_index = i + 1
        lines.insert(import_index, f'from {correct_module_name} import *')
        test_code = '\n'.join(lines)
    
    return test_code


def check_dependencies():
    """Check if testing tools are installed"""
    try:
        result = subprocess.run(['pytest', '--version'], capture_output=True, timeout=5)
        pytest_available = result.returncode == 0
        result = subprocess.run(['coverage', '--version'], capture_output=True, timeout=5)
        coverage_available = result.returncode == 0
        return {'pytest': pytest_available, 'coverage': coverage_available}
    except Exception as e:
        print(f"Dependency check failed: {e}")
        return {'pytest': False, 'coverage': False}


def run_python_coverage(source_code, test_code, filename):
    """Run pytest with coverage"""
    print("\n" + "="*60)
    print("STARTING COVERAGE ANALYSIS")
    print("="*60)
    
    temp_dir = tempfile.mkdtemp()
    print(f"Created temp directory: {temp_dir}")
    
    try:
        base_filename = filename.replace('.py', '')
        source_filename = f"{base_filename}.py"
        test_filename = f"test_{base_filename}.py"
        
        source_path = os.path.join(temp_dir, source_filename)
        test_path = os.path.join(temp_dir, test_filename)
        
        print(f"Writing source to: {source_filename}")
        with open(source_path, 'w', encoding='utf-8') as f:
            f.write(source_code)
        
        print(f"Writing tests to: {test_filename}")
        
        # Add mock setup for missing dependencies
        mock_setup = """# Mock setup for missing dependencies
import sys
from unittest.mock import MagicMock

missing_packages = ['requests', 'numpy', 'pandas', 'django', 'flask', 'sqlalchemy', 
                   'psycopg2', 'mysql', 'boto3', 'redis', 'celery']
for pkg in missing_packages:
    if pkg not in sys.modules:
        sys.modules[pkg] = MagicMock()

"""
        
        with open(test_path, 'w', encoding='utf-8') as f:
            f.write(mock_setup + "\n" + test_code)
        
        open(os.path.join(temp_dir, '__init__.py'), 'w').close()
        
        print(f"Running: pytest {test_filename} --cov={base_filename}")
        
        cmd = [
            sys.executable, '-m', 'pytest',
            test_filename,
            f'--cov={base_filename}',
            '--cov-report=term-missing',
            '--cov-report=json',
            '-v',
            '--tb=short'
        ]
        
        result = subprocess.run(cmd, cwd=temp_dir, capture_output=True, text=True, timeout=30)
        
        print("\nSTDOUT:")
        print(result.stdout)
        print("\nSTDERR:")
        print(result.stderr)
        print(f"\nReturn code: {result.returncode}")
        
        coverage_json_path = os.path.join(temp_dir, 'coverage.json')
        
        if os.path.exists(coverage_json_path):
            print("Found coverage.json")
            with open(coverage_json_path, 'r') as f:
                coverage_data = json.load(f)
            
            file_coverage = None
            for file_path, data in coverage_data.get('files', {}).items():
                if source_filename in file_path or base_filename in file_path:
                    file_coverage = data
                    break
            
            if file_coverage:
                coverage_percent = file_coverage['summary']['percent_covered']
                missing_lines = file_coverage.get('missing_lines', [])
                executed_lines = file_coverage.get('executed_lines', [])
                
                print(f"Coverage: {coverage_percent}%")
                print(f"Executed lines: {len(executed_lines)}")
                print(f"Missing lines: {len(missing_lines)}")
                
                missing_str = format_missing_lines(missing_lines)
                coverage_table = extract_coverage_table(result.stdout)
                
                return {
                    'success': True,
                    'coverage': round(coverage_percent, 1),
                    'missing_lines': missing_str,
                    'coverage_table': coverage_table,
                    'test_passed': result.returncode == 0,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
        
        print("No coverage.json, parsing terminal output...")
        coverage_match = re.search(r'TOTAL.*?(\d+)%', result.stdout)
        if coverage_match:
            coverage_percent = float(coverage_match.group(1))
            missing_match = re.search(r'Missing:?\s+([\d,\s-]+)', result.stdout, re.IGNORECASE)
            missing_str = missing_match.group(1).strip() if missing_match else "Unable to determine"
            coverage_table = extract_coverage_table(result.stdout)
            
            print(f"Parsed coverage: {coverage_percent}%")
            
            return {
                'success': True,
                'coverage': coverage_percent,
                'missing_lines': missing_str,
                'coverage_table': coverage_table,
                'test_passed': result.returncode == 0,
                'stdout': result.stdout
            }
        
        print("Could not parse coverage from output")
        return {
            'success': False,
            'error': 'Could not parse coverage output',
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    
    except subprocess.TimeoutExpired:
        print("Test execution timeout (30s)")
        return {'success': False, 'error': 'Test execution timeout (30 seconds)'}
    except FileNotFoundError as e:
        print(f"File not found: {e}")
        return {'success': False, 'error': 'pytest not found. Install: pip install pytest pytest-cov'}
    except Exception as e:
        print(f"Exception: {e}")
        print(traceback.format_exc())
        return {'success': False, 'error': str(e)}
    finally:
        print("Cleaning up temp directory...")
        shutil.rmtree(temp_dir, ignore_errors=True)
        print("="*60 + "\n")


def format_missing_lines(missing_lines):
    """Format missing lines into ranges"""
    if not missing_lines:
        return "None"
    if isinstance(missing_lines, str):
        return missing_lines
    
    try:
        lines = sorted([int(x) for x in missing_lines])
    except:
        return str(missing_lines)
    
    if not lines:
        return "None"
    
    ranges = []
    start = lines[0]
    end = lines[0]
    
    for line in lines[1:]:
        if line == end + 1:
            end = line
        else:
            if start == end:
                ranges.append(str(start))
            else:
                ranges.append(f"{start}-{end}")
            start = end = line
    
    if start == end:
        ranges.append(str(start))
    else:
        ranges.append(f"{start}-{end}")
    
    return ", ".join(ranges)


def extract_coverage_table(output):
    """Extract coverage table from pytest output"""
    lines = output.split('\n')
    table_lines = []
    in_table = False
    
    for line in lines:
        if '-----' in line or ('Name' in line and 'Stmts' in line):
            in_table = True
        if in_table:
            if line.strip() == '' and table_lines:
                break
            if line.strip():
                table_lines.append(line)
    
    return '\n'.join(table_lines) if table_lines else 'Coverage table not found'


@app.route("/api/generate-tests", methods=["POST", "OPTIONS"])
def generate_tests():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    
    try:
        data = request.json or {}
        source_code = data.get("code", "").strip()
        language = data.get("language", "JavaScript")
        framework = data.get("framework", "Jest")
        coverage_target = data.get("coverageTarget", 80)
        filename = data.get("filename", "app")
        
        if not source_code:
            return jsonify({"status": "error", "message": "No source code provided"}), 400
        
        print(f"\n{'='*60}")
        print(f"Target Coverage: {coverage_target}%")
        print(f"Language: {language} | Framework: {framework}")
        print(f"Filename: {filename}")
        print(f"{'='*60}\n")
        
        can_analyze_coverage = language == "Python"
        
        if not can_analyze_coverage:
            print(f"Coverage analysis not available for {language}")
        
        if can_analyze_coverage:
            deps = check_dependencies()
            print(f"Dependencies: {deps}")
            if not deps.get('pytest'):
                print("pytest not available, coverage analysis will be skipped")
                can_analyze_coverage = False
        
        module_name = filename.replace('.py', '').replace('-', '_')
        
        prompt = f"""Generate comprehensive unit tests using {framework} for {language}.

Target Coverage: {coverage_target}%

Source Code (filename: {module_name}.py):
```{language.lower()}
{source_code}
```

CRITICAL REQUIREMENTS:
1. The import statement MUST be: from {module_name} import *
2. Or import specific functions: from {module_name} import function1, function2, Class1
3. Write tests that cover ALL functions, methods, classes, and branches
4. Include edge cases, error handling, and boundary conditions
5. Use descriptive test names following pytest conventions (test_*)
6. Mock external dependencies if needed (use unittest.mock)
7. Return ONLY the test code, no markdown formatting, no explanations

IMPORTANT: The module name is "{module_name}" - use this exact name in imports!

Generate the complete test file:
"""
        
        print("Calling Groq API for initial test generation...")
        test_code = call_groq_api(prompt, max_tokens=6000)
        
        if not test_code:
            return jsonify({"status": "error", "message": "LLM failed to generate tests"}), 500
        
        test_code = extract_code_from_markdown(test_code)
        test_code = fix_imports_in_test_code(test_code, module_name)
        
        print(f"Generated {len(test_code)} characters of test code")
        print(f"Fixed imports to use module: {module_name}")
        
        first_lines = '\n'.join(test_code.split('\n')[:10])
        print(f"First lines of test code:\n{first_lines}\n")
        
        coverage_result = None
        iteration = 1
        
        if can_analyze_coverage:
            while iteration <= MAX_ITERATIONS:
                print(f"\n{'='*60}")
                print(f"Iteration {iteration}/{MAX_ITERATIONS}: Running coverage analysis...")
                print(f"{'='*60}")
                
                coverage_result = run_python_coverage(source_code, test_code, filename)
                
                if not coverage_result.get('success'):
                    error_msg = coverage_result.get('error', 'Unknown error')
                    print(f"Coverage analysis failed: {error_msg}")
                    
                    if 'stdout' in coverage_result:
                        print(f"Debug - stdout: {coverage_result['stdout'][:500]}")
                    if 'stderr' in coverage_result:
                        print(f"Debug - stderr: {coverage_result['stderr'][:500]}")
                    
                    break
                
                current_coverage = coverage_result['coverage']
                print(f"Current Coverage: {current_coverage}%")
                
                if current_coverage >= coverage_target:
                    print(f"Target coverage {coverage_target}% achieved!")
                    break
                
                if iteration < MAX_ITERATIONS:
                    print(f"Coverage {current_coverage}% < {coverage_target}%. Generating more tests...")
                    
                    missing_lines = coverage_result.get('missing_lines', 'Unknown')
                    
                    improve_prompt = f"""The current test coverage is {current_coverage}%, but we need {coverage_target}%.

Missing/Uncovered Lines: {missing_lines}

Source Code (filename: {module_name}.py):
```python
{source_code}
```

Current Tests:
```python
{test_code}
```

CRITICAL: Your imports MUST use: from {module_name} import *

Generate ADDITIONAL test cases to cover the missing lines.

Requirements:
- Use the correct import: from {module_name} import *
- Focus on lines: {missing_lines}
- Add new test functions (don't duplicate existing ones)
- Test edge cases, error paths, and boundary conditions
- Mock external dependencies if needed
- Return ONLY the COMPLETE test file with ALL tests (existing + new)

Generate the improved test file:
"""
                    
                    print("Generating additional tests...")
                    improved_tests = call_groq_api(improve_prompt, max_tokens=6000)
                    
                    if improved_tests:
                        test_code = extract_code_from_markdown(improved_tests)
                        test_code = fix_imports_in_test_code(test_code, module_name)
                        print(f"Updated test code ({len(test_code)} chars)")
                    else:
                        print("Failed to generate additional tests")
                        break
                else:
                    print(f"Max iterations ({MAX_ITERATIONS}) reached")
                
                iteration += 1
        
        if coverage_result and coverage_result.get('success'):
            final_coverage = coverage_result['coverage']
            
            if language == "Python":
                base_name = filename.replace('.py', '')
                run_command = f"python -m pytest test_{base_name}.py --cov={base_name} --cov-report=term-missing"
            elif framework == "Jest":
                run_command = f"npx jest {filename}.test.js --coverage"
            else:
                run_command = f"{framework.lower()} --coverage"
            
            coverage_report = {
                "totalCoverage": final_coverage,
                "runCommand": run_command,
                "summaryTable": coverage_result.get('coverage_table', 'N/A'),
                "missingLines": coverage_result.get('missing_lines', 'None'),
                "suggestions": generate_suggestions(final_coverage, coverage_target),
                "testPassed": coverage_result.get('test_passed', False)
            }
            
            print(f"\nFINAL RESULTS:")
            print(f"   Coverage: {final_coverage}%")
            print(f"   Target: {coverage_target}%")
            print(f"   Tests Passed: {coverage_result.get('test_passed')}")
        else:
            if can_analyze_coverage and coverage_result:
                error_detail = coverage_result.get('error', 'Unknown error')
            else:
                error_detail = f"Coverage analysis not available for {language}"
            
            coverage_report = {
                "totalCoverage": 0,
                "runCommand": f"Coverage analysis unavailable - {error_detail}",
                "summaryTable": f"Error: {error_detail}",
                "missingLines": "N/A",
                "suggestions": [
                    "Ensure pytest and pytest-cov are installed: pip install pytest pytest-cov",
                    "Verify the source code has no syntax errors",
                    "Check that all imports in tests are correct"
                ]
            }
        
        return jsonify({
            "status": "success",
            "tests": test_code.strip(),
            "coverageReport": coverage_report
        })
    
    except Exception as e:
        print(f"\nFATAL ERROR:")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


def generate_suggestions(current_coverage, target_coverage):
    """Generate suggestions based on coverage gap"""
    suggestions = []
    
    if current_coverage >= target_coverage:
        suggestions.append(f"Target coverage {target_coverage}% achieved!")
        suggestions.append("Consider adding integration tests for real-world scenarios")
        suggestions.append("Review test quality and add more assertions")
    else:
        gap = target_coverage - current_coverage
        suggestions.append(f"Need {gap}% more coverage to reach {target_coverage}%")
        suggestions.append("Focus on uncovered branches and edge cases")
        suggestions.append("Test error handling and exception paths")
        suggestions.append("Add tests for boundary conditions")
    
    return suggestions


@app.route("/api/health", methods=["GET"])
def health_check():
    deps = check_dependencies()
    return jsonify({
        "status": "success",
        "api_key_set": bool(GROQ_API_KEY),
        "model": DEFAULT_MODEL,
        "dependencies": deps
    })


@app.route("/api/detect-framework", methods=["POST", "OPTIONS"])
def detect_framework():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    
    data = request.json or {}
    filename = data.get("filename", "")
    ext = filename.split(".")[-1].lower()

    framework_map = {
        "js": "Jest", "jsx": "Jest",
        "ts": "Jest", "tsx": "Jest",
        "py": "pytest",
        "java": "JUnit"
    }

    language_map = {
        "js": "JavaScript", "jsx": "JavaScript",
        "ts": "TypeScript", "tsx": "TypeScript",
        "py": "Python",
        "java": "Java"
    }

    available_frameworks_map = {
        "JavaScript": ["Jest", "Mocha", "Jasmine"],
        "TypeScript": ["Jest", "Mocha", "Jasmine"],
        "Python": ["pytest", "unittest", "nose2"],
        "Java": ["JUnit", "TestNG", "Spock"]
    }

    detected_language = language_map.get(ext, "JavaScript")
    detected_framework = framework_map.get(ext, "Jest")
    available = available_frameworks_map.get(detected_language, [detected_framework])

    return jsonify({
        "status": "success",
        "framework": detected_framework,
        "language": detected_language,
        "extension": ext,
        "availableFrameworks": available
    })


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    
    print("\n" + "="*60)
    print("Flask Server Starting")
    print("="*60)
    print(f"Port: {port}")
    print(f"CORS: http://localhost:5173")
    print(f"Groq API Key: {'Set' if GROQ_API_KEY else 'Missing'}")
    
    deps = check_dependencies()
    print(f"\nDependencies:")
    print(f"   pytest: {'✓' if deps.get('pytest') else '✗ Run: pip install pytest pytest-cov'}")
    print(f"   coverage: {'✓' if deps.get('coverage') else '✗ Run: pip install pytest-cov'}")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=port, debug=True) 
