import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const API_BASE_URL = 'http://localhost:5000';

function Chatbot() {
    const [conversation, setConversation] = useState([]);
    const [recording, setRecording] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(2);
    const [questions, setQuestions] = useState([]);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/companies`);
                const data = await response.json();
                
                if (Array.isArray(data.companies)) {
                    setCompanies(data.companies);
                } else {
                    console.error('Invalid response format for companies:', data);
                }
            } catch (error) {
                console.error('Error fetching companies:', error);
            }
        };

        fetchCompanies();
    }, []);

    useEffect(() => {
        const fetchRoles = async () => {
            if (selectedCompany) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/roles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ company: selectedCompany })
                    });
                    const data = await response.json();
                    setRoles(data.roles);
                } catch (error) {
                    console.error('Error fetching roles:', error);
                }
            }
        };

        fetchRoles();
    }, [selectedCompany]);

    useEffect(() => {
        if (interviewStarted && currentQuestionIndex < questions.length) {
            updateConversation(questions[currentQuestionIndex], false);
            startRecording();
        } else if (interviewStarted && currentQuestionIndex >= questions.length) {
            updateConversation("Thank you for your time. I hope this preparation helps you in your interview. Good luck!", false);
            setInterviewStarted(false);
        }
    }, [currentQuestionIndex, questions, interviewStarted]);

    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setSelectedRole('');
    };

    const handleRoleChange = (event) => {
        setSelectedRole(event.target.value);
    };

    const updateConversation = (message, isUser) => {
        setConversation(prevConversation => [...prevConversation, { text: message, user: isUser }]);
    };

    const apiRequest = async (endpoint, data) => {
        try {
            console.log(`Sending request to ${endpoint}:`, data);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error (${endpoint}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error during API request to ${endpoint}:`, error);
            throw error;
        }
    };

    const startRecording = () => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorder.current = recorder;
                audioChunks.current = [];

                recorder.ondataavailable = event => {
                    audioChunks.current.push(event.data);
                };

                recorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                    convertToWav(audioBlob);
                };

                recorder.start();
                setRecording(true);
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                updateConversation('Error accessing microphone.', false);
            });
    };

    const convertToWav = (webmBlob) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();

        fileReader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const wavBlob = audioBufferToWav(audioBuffer);
                processAudio(wavBlob);
            } catch (error) {
                console.error('Error converting audio:', error);
                updateConversation('Error converting audio.', false);
            }
        };

        fileReader.readAsArrayBuffer(webmBlob);
    };

  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const outBuffer = new ArrayBuffer(length);
    const view = new DataView(outBuffer);
    const channels = [];
    let sample, offset = 0;

    // write WAVE header
    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - offset - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (offset < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset / (2 * numOfChan)]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }

    return new Blob([outBuffer], { type: 'audio/wav' });

    function setUint16(data) {
      view.setUint16(offset, data, true);
      offset += 2;
    }

    function setUint32(data) {
      view.setUint32(offset, data, true);
      offset += 4;
    }
  };

  const processAudio = async (audioBlob) => {
    updateConversation('Processing audio...', false);

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');

        const response = await fetch(`${API_BASE_URL}/api/recognize`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const recognizedText = data.text;

        updateConversation(recognizedText, true);
        await handleAnswer(recognizedText);
    } catch (error) {
        console.error('Error recognizing speech:', error);
        updateConversation('Error recognizing speech. Please try again.', false);
        startRecording(); // Retry recording
    }
};

const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
        mediaRecorder.current.stop();
        setRecording(false);
    }
};

const handleAnswer = async (answer) => {
    const currentQuestion = questions[currentQuestionIndex];

    try {
        const analysis = await apiRequest('/api/analyze', { question: currentQuestion, answer });
        updateConversation(analysis.analysis, false);

        const suggestions = await apiRequest('/api/suggestions', { question: currentQuestion, answer });
        updateConversation("Suggestions: " + suggestions.suggestions.join('\n'), false);

        const followUp = await apiRequest('/api/followup', { question: currentQuestion, answer });
        updateConversation(followUp.followup, false);

        // Start recording for follow-up answer
        startRecording();

        // After follow-up, move to next question
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } catch (error) {
        console.error('Error processing answer:', error);
        updateConversation('Error processing answer. Please try again.', false);
        startRecording(); // Retry recording
    }
};

const handleStart = async () => {
    if (!selectedCompany || !selectedRole) {
        alert('Please select a company and job role.');
        return;
    }

    try {
        const data = await apiRequest('/api/start', { company: selectedCompany, role: selectedRole });

        if (data.error) {
            alert(data.error);
            return;
        }

        setQuestions(data.questions);
        updateConversation(data.summary, false);
        setInterviewStarted(true);
        setCurrentQuestionIndex(0);  // Start from the third question (index 2)
        updateConversation(data.questions[0], false);
        startRecording();
    } catch (error) {
        console.error('Error starting the interview:', error);
        updateConversation('Error starting the interview. Please try again.', false);
    }
};

return (
    <div className="chatbot-container">
        <h1>PrepAI Chatbot</h1>
        <div id="conversation">
            {conversation.map((msg, index) => (
                <div key={index} className={`message ${msg.user ? 'user-message' : 'ai-message'}`}>
                    {msg.text}
                </div>
            ))}
        </div>
        <div className="controls">
            <div className="dropdown-group">
                <label htmlFor="companySelect">Select Company:</label>
                <select
                    id="companySelect"
                    value={selectedCompany}
                    onChange={handleCompanyChange}
                >
                    <option value="">Select</option>
                    {companies.map((company) => (
                        <option key={company} value={company}>{company}</option>
                    ))}
                </select>
            </div>
            <div className="dropdown-group">
                <label htmlFor="roleSelect">Select Job Role:</label>
                <select
                    id="roleSelect"
                    value={selectedRole}
                    onChange={handleRoleChange}
                >
                    <option value="">Select</option>
                    {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
            </div>
            {!interviewStarted ? (
                <button onClick={handleStart}>Start Interview</button>
            ) : (
                <button onClick={stopRecording} disabled={!recording}>
                    {recording ? 'Stop Recording' : 'Waiting...'}
                </button>
            )}
        </div>
    </div>
);
}

export default Chatbot;