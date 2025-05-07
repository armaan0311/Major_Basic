from flask import Flask, request, jsonify,render_template
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
import speech_recognition as sr
import os
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import numpy as np
import base64
import logging
import sys
from deepface import DeepFace
import threading
import requests
from flask import current_app
from datetime import datetime

from flask import send_file
import tempfile
import pdfkit

PDFKIT_CONFIG = pdfkit.configuration(
    wkhtmltopdf=r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
)



logging.basicConfig(level=logging.ERROR, stream=sys.stdout)


# Configure Google Generative AI
os.environ['API_KEY'] = 'AIzaSyDoz5h8MqTnuwqE-HDzTZAC5hSawTEfrFg'
genai.configure(api_key=os.getenv('API_KEY'))

os.environ['HEYGEN_API_KEY'] = "NDRlZDkwNzBmZmExNDI4ZWJjNjA3OWNlYWIxN2UyOTUtMTc0NjUwMzgyNA=="
HEYGEN_API_KEY = os.getenv('HEYGEN_API_KEY')

cv2.setLogLevel(3) 
os.environ["GLOG_minloglevel"] = "2"

app = Flask(__name__)
CORS(app,resources={r"/api/*": {"origins": "http://localhost:3000"}})

ex_data = pd.read_csv('IE Extracted (2).csv')

socketio = SocketIO(app, cors_allowed_origins="*")

#Initialize MediaPipe FaceMesh for facial tracking
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.4, min_tracking_confidence=0.4)

LEFT_EYE = [33, 133]  # Example indexes
RIGHT_EYE = [362, 263]
NOSE_TIP = 1

# Lucas-Kanade Optical Flow Parameters
lk_params = dict(
    winSize=(15, 15),
    maxLevel=2,
    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03),
)

# Global variables for tracking previous frame
prev_gray = None
prev_iris_pts = None


def summarize_text(company, role, text):
    prompt = f"""
    Summarize the following interview experience in a structured format:
    Company Name: {company}
    Role: {role}

    Format the summary as follows:
    - Interview Highlights: Key points of the interview.(20  words)
    - Pros: Positive aspects of the interview experience.(20  words)
    - Cons: Negative aspects of the interview experience.(20  words)

    Text: {text}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text

def generate_greeting(company, role):
    """
    Generate a time-based greeting for the interview.
    """
    hour = datetime.now().hour
    if hour < 12:
        salutation = 'Good morning'
    elif hour < 18:
        salutation = 'Good afternoon'
    else:
        salutation = 'Good evening'
    return f"{salutation}! You are interviewing for the {role} role at {company}."


def generate_questions(summary, num_questions=1):
    prompt = f"""
    Based on the following interview summary, generate {num_questions} personality-based
    questions that could be asked in an interview (only questions):

    {summary}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text.splitlines()

def analyze_answer(question_text,answer_text):
    prompt = f"""
    Evaluate the following answer in the context of a job interview:
    {question_text,answer_text}

    Provide:
    - Overall Evaluation: A short assessment of the answer.(20-30 words)
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text

def generate_friendly_reply(answer):
    return "Good, that’s great!"


def generate_follow_up(question, answer_text):
    prompt = f"""
    Based on the interview question and the candidate's answer,
    generate a relevant follow-up question(20-30 words):

    Question: {question}
    Answer: {answer_text}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text.strip()

def generate_suggestions(question, answer_text):
    prompt = f"""
    Based on the interview question and the candidate's answer,
    provide specific suggestions on how the candidate could improve
    their answer(20-30 words):

    Question: {question}
    Answer: {answer_text}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text.splitlines()

def process_video(frame):
    """Runs face analysis in a separate thread."""
    thread = threading.Thread(target=analyze_face, args=(frame,))
    thread.start()
    
def calculate_eye_position(landmarks, width, height):
    """Calculates eye position relative to the screen."""
    if not landmarks:
        return None

    left_x, left_y = int(landmarks[LEFT_EYE[0]].x * width), int(landmarks[LEFT_EYE[0]].y * height)
    right_x, right_y = int(landmarks[RIGHT_EYE[0]].x * width), int(landmarks[RIGHT_EYE[0]].y * height)
    nose_x, nose_y = int(landmarks[NOSE_TIP].x * width), int(landmarks[NOSE_TIP].y * height)

    eye_mid_x = (left_x + right_x) // 2
    eye_mid_y = (left_y + right_y) // 2

    return eye_mid_x, eye_mid_y, nose_x, nose_y

# 🔹 Detect if the user is looking away
def is_looking_away(landmarks, width, height):
    """Detect if user is looking away from the screen using eye position and EAR (Eye Aspect Ratio)."""
    if not landmarks:
        return False

    # Get eye landmark positions
    left_eye_inner = landmarks[133]  # Inner corner of left eye
    left_eye_outer = landmarks[33]   # Outer corner of left eye
    right_eye_inner = landmarks[362] # Inner corner of right eye
    right_eye_outer = landmarks[263] # Outer corner of right eye

    # Convert normalized coordinates to screen pixels
    left_eye_x = int((left_eye_inner.x + left_eye_outer.x) / 2 * width)
    right_eye_x = int((right_eye_inner.x + right_eye_outer.x) / 2 * width)
    midpoint_x = (left_eye_x + right_eye_x) // 2  # Middle of both eyes

    # Define safe region (25%-75% of screen width)
    safe_left = width * 0.2
    safe_right = width * 0.8

    # Detect if eyes are out of center region (looking away)
    if midpoint_x < safe_left or midpoint_x > safe_right:
        return True  # Looking too far left or right

    return False 

def track_eye_movement(frame, iris_points):
    """Tracks eye movement using Lucas-Kanade Optical Flow"""
    global prev_gray, prev_iris_pts

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    iris_points = np.array(iris_points, dtype=np.float32).reshape(-1, 1, 2)

    if prev_gray is None or prev_iris_pts is None:
        prev_gray = gray
        prev_iris_pts = iris_points
        return "center"

    # ✅ Optical Flow (Lucas-Kanade)
    new_pts, status, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, prev_iris_pts, None, **lk_params)
    movement = new_pts - prev_iris_pts

    avg_movement = np.mean(movement, axis=0)[0]

    # ✅ Determine direction based on movement vector
    if avg_movement[0] < -1.5: return "left"
    if avg_movement[0] > 1.5: return "right"
    if avg_movement[1] < -1.5: return "up"
    if avg_movement[1] > 1.5: return "down"

    prev_gray = gray
    prev_iris_pts = new_pts

    return "center"


# 🔹 Detect Facial Expressions (Emotion Detection)
def detect_emotion(frame):
    """Detects facial emotions using DeepFace."""
    try:
        results = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
        return results[0]['dominant_emotion']
    except Exception as e:
        logging.error(f"Emotion detection error: {str(e)}")
        return "neutral"  # Default if no face detected

def analyze_face(frame):
    """Detects face, eyes, and calculates attention score"""
    h, w, _ = frame.shape
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)  # Convert to grayscale
    edges = cv2.Canny(gray, 50, 150)  # ✅ Faster edge detection

    # ✅ Process face landmarks using MediaPipe
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    attention_score = 100  # Start at max score
    looking_away = False

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            looking_away = is_looking_away(face_landmarks.landmark, w, h)

            # ✅ Reduce attention score if looking away
            if looking_away:
                attention_score -= 40
            else:
                attention_score = min(attention_score + 10, 100)  # Recovery

            # ✅ Draw face landmarks (green dots)
            for landmark in face_landmarks.landmark:
                x, y = int(landmark.x * w), int(landmark.y * h)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

    return frame, max(attention_score, 0), looking_away  # Ensure score stays positive


def fetch_tech_stack(company, role):
    """
    Use Gemini to generate the typical tech stack and frequently asked technologies
    for the given company and role.
    """
    prompt = f"""
    For the role of {role} at {company}, list:
    1. Core technologies and tools typically required.
    2. Additional libraries or frameworks you should be familiar with.
    3. Topics or technologies often asked about in interviews.

    Provide as bullet points.
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content([prompt])
    return resp.text.strip().splitlines()

# New helper to generate weak points and preparation suggestions

def fetch_weak_points_and_resources(interview_data):
    """
    Analyze all answers in interview_data to surface recurring weaknesses
    and recommend learning materials or resources.
    """
    # Consolidate all Q&A into text
    combined = "\n".join([f"Q: {item['question']} A: {item['answer']}" for item in interview_data])
    prompt = f"""
    Based on the following interview Q&A, identify the candidate's three main weak points
    and for each, suggest one or two resources (articles, tutorials, books) to improve.

    Text:
    {combined}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content([prompt])
    return resp.text.strip().splitlines()

@socketio.on("video_frame")
def handle_video_stream(data):
    """Processes video frame for facial tracking and gaze direction."""
    frame_data = base64.b64decode(data["image"])
    np_arr = np.frombuffer(frame_data, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    frame = cv2.resize(frame, (320, 240))
    threading.Thread(target=process_video, args=(frame,)).start()
    height, width, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    attention_score = 100
    looking_away = False
    emotion = "neutral"
    gaze_direction = "center"

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            if not face_landmarks.landmark:
                continue  # ✅ Prevent NoneType errors

            looking_away = is_looking_away(face_landmarks.landmark, width, height)
            if looking_away:
                attention_score -= 30  # Deduct score if looking away

            # Detect facial expressions
            emotion = detect_emotion(frame)

            # Adjust attention score based on emotions
            if emotion in ["angry", "fear", "sad"]:
                attention_score -= 20
            elif emotion in ["happy", "surprise"]:
                attention_score += 10

            # ✅ Track eye movement using Lucas-Kanade
            left_eye = face_landmarks.landmark[LEFT_EYE[0]]
            right_eye = face_landmarks.landmark[RIGHT_EYE[0]]
            iris_pts = [[left_eye.x * width, left_eye.y * height], [right_eye.x * width, right_eye.y * height]]

            gaze_direction = track_eye_movement(frame, iris_pts)

            # ✅ Draw facial landmarks
            for landmark in face_landmarks.landmark:
                x, y = int(landmark.x * width), int(landmark.y * height)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)  # Draw green dots

    # ✅ Determine border color based on looking away
    border_color = "red" if looking_away else "green"

    # Encode frame to send back
    _, buffer = cv2.imencode('.jpg', frame)
    encoded_frame = base64.b64encode(buffer).decode('utf-8')

    socketio.emit("video_analysis", {
        "image": encoded_frame,
        "looking_away": looking_away,
        "border_color": border_color,
        "gaze_direction": gaze_direction,  # Send gaze tracking data
        "emotion": emotion,
        "attention_score": max(attention_score, 0)  # Ensure score doesn't go negative
    })


@app.route('/')
def index():
    return "Server is running!"
def home():
    return "PrepAI Chatbot API is running"

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route("/api/companies", methods=["GET"])
def get_companies():
    companies = ex_data['company'].unique().tolist()
    return jsonify({'companies': companies})

@app.route("/api/roles", methods=["POST"])
def get_roles():
    data = request.get_json()
    company = data.get("company")
    if not company:
        return jsonify({"error": "Missing company"}), 400
    roles = ex_data[ex_data["company"] == company]["role"].unique().tolist()
    return jsonify({"roles": roles})

@app.route("/api/start", methods=["POST"])
def start_interview():
    data = request.get_json()
    print("Received data for start_interview:", data)  # Log received data
    company = data.get("company")
    role = data.get("role")

    if not all([company, role]):
        print(f"Missing data: company={company}, role={role}")  # Log missing data
        return jsonify({"error": f"Missing company or role. Received: company={company}, role={role}"}), 400

    try:
        extracted_text = ex_data[
            (ex_data["company"] == company) & (ex_data["role"] == role)
        ]["extracted_text"].values[0]
    except IndexError:
        print(f"No matching interview text found for company={company}, role={role}")  # Log when no match is found
        return jsonify({"error": f"No matching interview text found for company={company}, role={role}"}), 400
    greeting = generate_greeting(company, role)
    summary = summarize_text(company, role, extracted_text)
    questions = generate_questions(summary)
    questions = [q for q in questions[0:] if q != '']
    #print("Generated questions:", questions)
    print("greeting",greeting)
    #print(f"Generated {len(questions)} questions for {company}, {role}")  # Log number of questions generated
    return jsonify({"summary": summary,"greeting" : greeting, "questions": questions})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    question=data.get('question')
    answer = data.get('answer')
    if not answer:
        return jsonify({'error': 'Missing answer'}), 400
    analysis = analyze_answer(question,answer)
    return jsonify({'analysis': analysis})

@app.route('/api/suggestions', methods=['POST'])
def suggestions():
    data = request.get_json()
    print("Received data for suggestions:", data)  # Add this line
    question = data.get('question')
    answer = data.get('answer')
    
    if not all([question, answer]):
        print(f"Missing data: question={question}, answer={answer}")  # Add this line
        return jsonify({'error': 'Missing question or answer'}), 400
    
    try:
        suggestions = generate_suggestions(question, answer)
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        print(f"Error generating suggestions: {str(e)}")
        return jsonify({'error': 'An error occurred while generating suggestions'}), 500

@app.route('/api/friendly_response', methods=['POST'])
def friendly_response():
    data = request.get_json()
    answer = data.get('answer')

    if not answer:
        return jsonify({'error': 'Missing answer'}), 400

    reply = generate_friendly_reply(answer)
    return jsonify({'reply': reply})


@app.route('/api/followup', methods=['POST'])
def followup():
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')
    if not all([question, answer]):
        return jsonify({'error': 'Missing question or answer'}), 400
    follow_up = generate_follow_up(question, answer)
    return jsonify({'followup': follow_up})

@app.route('/api/recognize', methods=['POST'])
def recognize():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    
    print(f"Received audio file: {audio_file.filename}")
    print(f"Content type: {audio_file.content_type}")

    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)
        
        recognized_text = recognizer.recognize_google(audio)
        print("Recognized Text:", recognized_text)
        return jsonify({'text': recognized_text})
    except sr.UnknownValueError:
        print("Speech Recognition could not understand audio")
        return jsonify({'error': 'Could not understand audio'}), 400
    except sr.RequestError as e:
        print(f"Could not request results from Speech Recognition service; {e}")
        return jsonify({'error': f"Could not request results; {e}"}), 500
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500
    
@app.route('/api/generate_report', methods=['POST'])
def generate_report():

    payload = request.get_json()
    company = payload.get('company', 'N/A')
    role = payload.get('role', 'N/A')
    interview_data = payload.get('interviewData', [])

    if not all([company, role]):
        print(f"Missing data: company={company}, role={role}")  # Log missing data
        return jsonify({"error": f"Missing company or role. Received: company={company}, role={role}"}), 400

    try:
        extracted_text = ex_data[
            (ex_data["company"] == company) & (ex_data["role"] == role)
        ]["extracted_text"].values[0]
    except IndexError:
        print(f"No matching interview text found for company={company}, role={role}")  # Log when no match is found
        return jsonify({"error": f"No matching interview text found for company={company}, role={role}"}), 400
    
    summary_text= summarize_text(company, role, extracted_text)
    # 2. Fetch tech stack details
    tech_points = fetch_tech_stack(company, role)

    # 3. Build HTML report sections
    html = ['<html><head><meta charset="utf-8"><style>',
            'body{font-family:Arial,sans-serif;margin:20px;} h1,h2{color:#2c3e50;} ul{margin-left:20px;} ',
            '</style></head><body>',
            f'<h1>Interview Report</h1>',
            f'<p><strong>Company:</strong> {company}<br><strong>Role:</strong> {role}</p>',
            '<h2>Summary</h2>', f'<p>{summary_text}</p>',
            '<h2>Tech Stack & Interview Topics</h2>', '<ul>']
    for pt in tech_points:
        html.append(f'<li>{pt}</li>')
    html.append('</ul>')

    # 4. Questions, answers, analysis, suggestions
    html.append('<h2>Q&A with Analysis</h2>')
    for idx, item in enumerate(interview_data, 1):
        q = item.get('question', '')
        a = item.get('answer', '')
        analysis = analyze_answer(q, a)
        suggestions = generate_suggestions(q, a)
        html.append(f'<h3>{idx}. {q}</h3>')
        html.append(f'<p><strong>Answer:</strong> {a}</p>')
        html.append(f'<p><strong>Analysis:</strong> {analysis}</p>')
        html.append('<p><strong>Suggestions:</strong></p><ul>')
        for s in suggestions:
            html.append(f'<li>{s}</li>')
        html.append('</ul>')
        fq = item.get('followUpQuestion')
        fa = item.get('followUpAnswer')
        if fq and fa:
            an2 = analyze_answer(fq, fa)
            sug2 = generate_suggestions(fq, fa)
            html.append(f'<h4>Follow-up: {fq}</h4>')
            html.append(f'<p><strong>Answer:</strong> {fa}</p>')
            html.append(f'<p><strong>Analysis:</strong> {an2}</p>')
            html.append('<p><strong>Suggestions:</strong></p><ul>')
            for s2 in sug2:
                html.append(f'<li>{s2}</li>')
            html.append('</ul>')

    # 5. Metric scores chart placeholder
   # html.append('<h2>Attention & Emotion Metrics</h2>')
    #html.append('<p>See attached chart for average attention and emotion distribution.</p>')

    # 6. Weak points & resources
    html.append('<h2>Weak Points & Resources</h2>')
    weak_lines = fetch_weak_points_and_resources(interview_data)
    html.append('<ul>')
    for w in weak_lines:
        html.append(f'<li>{w}</li>')
    html.append('</ul>')

    html.append('</body></html>')
    full_html = ''.join(html)

    # Render PDF using pdfkit
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    # then in your route:
    pdfkit.from_string(full_html, tmp.name, configuration=PDFKIT_CONFIG)

    filename = os.path.basename(tmp.name)
    return send_file(
        tmp.name,
        as_attachment=True,
        download_name="Interview_Report.pdf",
        mimetype="application/pdf"
    )


@app.route('/api/heygen_token', methods=['GET'])
def get_heygen_token():
   
    if not HEYGEN_API_KEY:
        return jsonify({'error': 'HeyGen API key not configured'}), 500

    # Call HeyGen streaming.create_token endpoint
    try:
        resp = requests.post(
            'https://api.heygen.com/v1/streaming.create_token',
            headers={ 'x-api-key': HEYGEN_API_KEY }
        )
        resp.raise_for_status()
        data = resp.json().get('data', {})
        token = data.get('token')
        if not token:
            raise ValueError('No token in HeyGen response')
        return jsonify({'token': token})
    except Exception as e:
        logging.error(f"Error fetching HeyGen token: {e}")
        return jsonify({'error': 'Failed to fetch HeyGen token'}), 500
    



if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")  # Debugging log
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, use_reloader=False)
    print("Server has stopped!") 