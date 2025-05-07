import React, { useState, useEffect, useRef, useCallback } from 'react';

import './Chatbot.css';
import io from "socket.io-client";

import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType, TaskMode } from '@heygen/streaming-avatar';

const API_BASE_URL = 'http://localhost:5001';
const socket = io(API_BASE_URL);

function Chatbot() {
    const [conversation, setConversation] = useState([]);
    const [recording, setRecording] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const [waitingForFollowUp, setWaitingForFollowUp] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const chatWindowRef = useRef(null);
    const [isFollowUp, setIsFollowUp] = useState(false);

    const [videoSrc, setVideoSrc] = useState("");
    const [lookingAway, setLookingAway] = useState(false);  // For displaying processed video
    const [attentionScore, setAttentionScore] = useState(100);
    const [emotion, setEmotion] = useState("neutral");
    const [borderColor, setBorderColor] = useState("green");
    const [gazeDirection, setGazeDirection] = useState("center");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const avatarRef = useRef(null);
    const avatarVideoRef = useRef(null);

      // holds an array of { question, answer, followUpQuestion?, followUpAnswer? }
    const [interviewData, setInterviewData] = useState([]);
    const [currentMetrics, setCurrentMetrics] = useState([]);



    useEffect(() => {
        console.log('Interview so far:', interviewData);
      }, [interviewData]);
      


    

   useEffect(() => {
        socket.on("video_analysis", (data) => {
            setCurrentMetrics(curr => [
                ...curr,
                {
                  timestamp: Date.now(),
                  attention: data.attention_score,
                  gaze:      data.gaze_direction,
                  emotion:   data.emotion,
                }
              ]);
            setVideoSrc(`data:image/jpeg;base64,${data.image}`);
            setAttentionScore(data.attention_score);
            setLookingAway(data.looking_away);
            setGazeDirection(data.gaze_direction);
            setEmotion(data.emotion);
        });

        return () => socket.off("video_analysis");
    }, []);
    
    const startVideoStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { frameRate: { ideal: 15, max: 20 } }});
            videoRef.current.srcObject = stream;

            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");
            const video = videoRef.current;

            let frameCount = 0; // ✅ Track frames to skip processing some
            setInterval(() => {
                frameCount++;
                if (frameCount % 3 !== 0) return;  // ✅ Process only every 3rd frame
            
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frame = canvas.toDataURL("image/jpeg");
                const base64Image = frame.split(",")[1];
            
                socket.emit("video_frame", { image: base64Image });
            }, 150);

        } catch (error) {
            console.error("❌ Error accessing webcam:", error);
        }
    };
// at top, next to apiRequest…
async function downloadReport() {
  const payload = { company: selectedCompany, role: selectedRole, interviewData };
  const res = await fetch(`${API_BASE_URL}/api/generate_report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to generate report");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Interview_Report.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

  

    const scrollToBottom = useCallback(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, []);

    const updateConversation = useCallback((message, isUser) => {
        return new Promise((resolve) => {
            setConversation(prevConversation => [...prevConversation, { text: message, user: isUser }]);
            if (!isUser && avatarRef.current) {
                avatarRef.current.speak({ text: message, task_type: TaskType.TALK, taskMode: TaskMode.SYNC });
                avatarRef.current.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
                    resolve();
                });
            } else {
                resolve();
            }
            setTimeout(scrollToBottom, 100);
        });
    }, [scrollToBottom]);

    async function speakWithAvatarChunks(text) {
        const avatar = avatarRef.current;
        const sentences = text.match(/[^\.\!\?]+[\.\!\?]*/g) || [text];
        for (let s of sentences) {
          const chunk = s.trim();
          if (!chunk) continue;
          try {
            await avatar.speak({ text: chunk, task_type: TaskType.TALK, taskMode: TaskMode.SYNC });
          } catch (err) {
            console.error('Avatar speak error:', err);
            break;
          }
          // wait for stop talking event
          await new Promise(res => avatar.on(StreamingEvents.AVATAR_STOP_TALKING, res));
          // short pause
          await new Promise(res => setTimeout(res, 600));
        }
      }
      const speakWithAvatar = async (text) => {
        if (!avatarRef.current) return;
        await avatarRef.current.speak({
          text,
          task_type: TaskType.TALK,
          taskMode: TaskMode.SYNC
        });
      };
      
// Initialize HeyGen avatar session
    async function initAvatarSession() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/heygen_token`);
      const { token } = await res.json();
      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;
      avatar.on(StreamingEvents.STREAM_READY, e => {
        if (avatarVideoRef.current) {
          avatarVideoRef.current.srcObject = e.detail;
          avatarVideoRef.current.play().catch(console.error);
        }
      });
      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        // optionally disable recording while avatar speaks
        setRecording(false);
      });
      await avatar.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: 'Pedro_Chair_Sitting_public',
        voice: { voiceId: '42d598350e7a4d339a3875eb1b0169fd', rate: 1.0 },
        language: 'en'
      });
    } catch (err) {
      console.error('initAvatarSession error:', err);
    }
  }
  const endAvatarSession = async () => {
    try {
      if (avatarRef.current) {
        await avatarRef.current.stop();  // Ends the session on Heygen
        avatarRef.current = null;
      }
      if (avatarVideoRef.current && avatarVideoRef.current.srcObject) {
        const tracks = avatarVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());  // Stop video stream
        avatarVideoRef.current.srcObject = null;
      }
    } catch (err) {
      console.error('Error ending avatar session:', err);
    }
  };
  

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
        const deliverQuestion = async () => {
            if (interviewStarted && currentQuestionIndex < questions.length && !isFollowUp) {
                await updateConversation(questions[currentQuestionIndex], false);
                startRecording(); // ✅ Start only after avatar finishes
            } else if (interviewStarted && currentQuestionIndex >= questions.length) {
                await updateConversation("Thank you for your time. I hope this preparation helps you in your interview. Good luck!", false);
                setInterviewStarted(false);
                downloadReport();
                setTimeout(() => {
                    endAvatarSession();
                }, 1000);
            }
        };
    
        deliverQuestion();
    }, [currentQuestionIndex, questions, interviewStarted, isFollowUp, updateConversation]);
    
    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setSelectedRole('');
    };

    const handleRoleChange = (event) => {
        setSelectedRole(event.target.value);
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

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
            mediaRecorder.current.stop();
            setRecording(false);
        }
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
    if (audioBlob.size === 0) {
        console.error("Empty audio blob, skipping recognition.");
        updateConversation("Could not record audio. Please try again.", false);
        return;
    }
    

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
    }
};

const handleAnswer = async (answer) => {
    const currentQuestion = questions[currentQuestionIndex];
  
    // 1) record this Q→A
    setInterviewData(d => [
      ...d,
      { question: currentQuestion, answer,
        metrics: currentMetrics 
       }
    ]);
    setCurrentMetrics([]);

    try {
      // 2) get a friendly reply
      const { reply } = await apiRequest('/api/friendly_response', { answer });
      await updateConversation(reply, false);
  
      // 3) then follow-up
      if (!isFollowUp) {
        const { followup } = await apiRequest('/api/followup', { question: currentQuestion, answer });
        // record followUp Q
        setInterviewData(d => {
          const last = d[d.length - 1];
          return [
            ...d.slice(0, -1),
            { ...last, followUpQuestion: followup }
          ];
        });
        await updateConversation(followup, false);
        setIsFollowUp(true);
      } else {
        // record the follow-up answer
        setInterviewData(d => {
          const last = d[d.length - 1];
          return [
            ...d.slice(0, -1),
            { ...last, followUpAnswer: answer,
                followUpMetrics: currentMetrics
             }
          ];
        });
        setIsFollowUp(false);
        setCurrentQuestionIndex(i => i + 1);
      }
    } catch (error) {
      console.error('Error processing answer:', error);
      updateConversation('Error processing answer. Please try again.', false);
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
        await initAvatarSession();
        //updateConversation(data.greeting, false);
        await speakWithAvatar(data.greeting);

        setQuestions(data.questions);
        setInterviewStarted(true);
        startVideoStream();
        setCurrentQuestionIndex(0);
        setIsFollowUp(false);
        //updateConversation(data.questions[0], false);
        
        
    } catch (error) {
        console.error('Error starting the interview:', error);
        updateConversation('Error starting the interview. Please try again.', false);
    }
};

return (
    <div className="chatbot-container">
        <h1>PrepAI Interview Simulator</h1>

        {/* 🔹 Chat & Video Analysis SIDE BY SIDE */}
        <div className="chat-interface">
      {/* AI avatar */}
      <div className="avatar-container">
        <video
          ref={avatarVideoRef}
          className="avatar-video"
          autoPlay
          playsInline
        />
      </div>

      {/* User camera */}
      <div className="video-analysis-container">
        <h2>Your Camera</h2>
        <video
          ref={videoRef}
          className="video-analysis"
          autoPlay
          muted
        />
        <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }} />

      </div>
    </div>

        {/* 🔹 Controls Section */}
        <div className="controls">
            {!interviewStarted ? (
                <>
                    <div className="dropdown-group">
                        <label htmlFor="companySelect">Select Company:</label>
                        <select id="companySelect" value={selectedCompany} onChange={handleCompanyChange}>
                            <option value="">Select</option>
                            {companies.map((company) => (
                                <option key={company} value={company}>{company}</option>
                            ))}
                        </select>
                    </div>
                    <div className="dropdown-group">
                        <label htmlFor="roleSelect">Select Job Role:</label>
                        <select id="roleSelect" value={selectedRole} onChange={handleRoleChange}>
                            <option value="">Select</option>
                            {roles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={handleStart}>Start Interview</button>
                </>
            ) : (
                <div className="recording-controls">
                    <button onClick={startRecording} disabled={recording}>Start Recording</button>
                    <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>
                    {recording && <span className="recording-indicator">Recording...</span>}
                    <button onClick={downloadReport}>
                     Download Interview Report PDF 
                    </button>
                </div>
            )}
        </div>

        {/* 🔹 Instructions Section */}
        {!interviewStarted && (
            <div className="instructions">
                <h2>Instructions:</h2>
                <ol>
                    <li>Select a company and job role from the dropdowns.</li>
                    <li>Click 'Start Interview' to begin the simulation (also starts video analysis).</li>
                    <li>Read the interviewer's question carefully.</li>
                    <li>Click 'Start Recording' and speak your answer.</li>
                    <li>Click 'Stop Recording' when you've finished speaking.</li>
                    <li>Wait for the AI to process your answer and provide feedback.</li>
                    <li>Continue with follow-up questions as prompted.</li>
                </ol>
                <p>Good luck with your interview preparation!</p>
            </div>
        )}
    </div>
);


}

export default Chatbot;