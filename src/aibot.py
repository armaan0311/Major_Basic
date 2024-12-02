from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
import speech_recognition as sr
import os
import io
import wave

# Configure Google Generative AI
os.environ['API_KEY'] = 'AIzaSyDoz5h8MqTnuwqE-HDzTZAC5hSawTEfrFg'
genai.configure(api_key=os.getenv('API_KEY'))

app = Flask(__name__)
CORS(app)

ex_data = pd.read_csv('IE Extracted (2).csv')

def summarize_text(company, role, text):
    prompt = f"""
    Summarize the following interview experience in a structured format:
    Company Name: {company}
    Role: {role}

    Format the summary as follows:
    - Interview Highlights: Key points of the interview.
    - Pros: Positive aspects of the interview experience.
    - Cons: Negative aspects of the interview experience.

    Text: {text}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text

def generate_questions(summary, num_questions=3):
    prompt = f"""
    Based on the following interview summary, generate {num_questions} personality-based
    questions that could be asked in an interview:

    {summary}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text.splitlines()

def analyze_answer(answer_text):
    prompt = f"""
    Evaluate the following answer in the context of a job interview:
    {answer_text}

    Provide:
    - Overall Evaluation: A short assessment of the answer.
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text

def generate_follow_up(question, answer_text):
    prompt = f"""
    Based on the interview question and the candidate's answer,
    generate a relevant follow-up question:

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
    their answer:

    Question: {question}
    Answer: {answer_text}
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([prompt])
    return response.text.splitlines()

@app.route('/')
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
    company = data.get("company")
    role = data.get("role")

    if not all([company, role]):
        return jsonify({"error": "Missing company or role"}), 400

    try:
        extracted_text = ex_data[
            (ex_data["company"] == company) & (ex_data["role"] == role)
        ]["extracted_text"].values[0]
    except IndexError:
        return jsonify({"error": "No matching interview text found"}), 400

    summary = summarize_text(company, role, extracted_text)
    questions = generate_questions(summary)
    questions = [q for q in questions[2:] if q != '']
    
    return jsonify({"summary": summary, "questions": questions})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    answer = data.get('answer')
    if not answer:
        return jsonify({'error': 'Missing answer'}), 400
    analysis = analyze_answer(answer)
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)