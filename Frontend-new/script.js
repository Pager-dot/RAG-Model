const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const attachmentBtn = document.getElementById('attachment-btn');
const fileInputHidden = document.createElement('input'); 
fileInputHidden.type = 'file';
fileInputHidden.accept = '.pdf'; 
fileInputHidden.style.display = 'none';
document.body.appendChild(fileInputHidden); 
const suggestBtn = document.getElementById('suggest-btn');

const userMessageTemplate = document.getElementById('user-message-template');
const botMessageTemplate = document.getElementById('bot-message-template');
const typingIndicatorTemplate = document.getElementById('typing-indicator-template');

const chatHistory = [{
    role: "model",
    parts: [{ text: "You are a helpful and friendly AI assistant." }]
}];

// --- Voice Recording State and Objects ---
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Function to handle the upload of the recorded audio
const uploadAudioForTranscription = async (audioBlob) => {
    // 1. Display a status message
    const uploadStatus = displayMessage(botMessageTemplate, `**🎙️ Transcribing Audio...**`);

    const formData = new FormData();
    formData.append("audio_file", audioBlob, "user_recording.webm"); 

    try {
        const response = await fetch('/transcribe-audio/', { 
            method: 'POST',
            body: formData 
        });

        chatContainer.removeChild(uploadStatus);

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.detail || 'Transcription failed due to a server error.';
            displayMessage(botMessageTemplate, `**❌ Transcription Failed:** ${errorMessage}`);
            return;
        }

        const data = await response.json();
        const transcribedText = data.text_english;

        if (!transcribedText) {
             displayMessage(botMessageTemplate, `**⚠️ Transcription issue:** Received an empty response from the server.`);
             return;
        }

        // 2. Display success and populate the message input(for debugging)
        //displayMessage(botMessageTemplate, `**✅ Audio Transcribed!**`);
        
        messageInput.value = transcribedText;

    } catch (error) {
        chatContainer.removeChild(uploadStatus);
        displayMessage(botMessageTemplate, `**⚠️ Network Error:** Could not connect to the transcription server. ${error.message}`);
        console.error('Transcription Upload Error:', error);
    }
};

// --- Existing uploadFileToBackend for PDF ---
const uploadFileToBackend = async (file) => {
    // 1. Display a status message
    const uploadStatus = displayMessage(botMessageTemplate, `**Uploading File:** ${file.name} (Type: ${file.type}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
        
    const formData = new FormData();
    formData.append("file", file); 

    try {
        const response = await fetch('/upload-pdf/', {
            method: 'POST',
            body: formData 
        });

        chatContainer.removeChild(uploadStatus);

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.detail || 'Upload failed due to a server error.';
            displayMessage(botMessageTemplate, `**❌ Upload Failed:** ${errorMessage}`);
            return;
        }

        const data = await response.json();
        // 2. Display success message(for debugging)
        //const successMessage = `**File Uploaded Successfully!**\nFilename: ${data.filename}\nPath: ${data.path}`;
        const successMessage = `**File Uploaded Successfully!`;
        displayMessage(botMessageTemplate, successMessage);
    
    } catch (error) {
        chatContainer.removeChild(uploadStatus);
        displayMessage(botMessageTemplate, `**⚠️ Network Error:** Could not connect to the upload server. ${error.message}`);
        console.error('Upload Error:', error);
    }
};

        // --- Gemini API Call with Exponential Backoff ---
        const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
            const apiKey = ""; // Canvas will provide this. 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

            // Add user prompt to a temporary history for the API call
            const currentChatHistory = [...chatHistory, { role: "user", parts: [{ text: prompt }] }];

            const payload = {
                contents: currentChatHistory
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    if (response.status === 429 && retries > 0) {
                        // Throttled, retry with backoff
                        await new Promise(res => setTimeout(res, delay));
                        return callGeminiAPI(prompt, retries - 1, delay * 2);
                    }
                    throw new Error(`API request failed with status ${response.status}`);
                }
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    // Add both user and model messages to the persistent history
                    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
                    chatHistory.push({ role: "model", parts: [{ text: text }] });
                    return text;
                } else {
                    return "Sorry, I couldn't generate a response. Please try again.";
                }

            } catch (error) {
                console.error("Error calling Gemini API:", error);
                 if (retries > 0) {
                    await new Promise(res => setTimeout(res, delay));
                    return callGeminiAPI(prompt, retries - 1, delay * 2);
                }
                return "Sorry, there was an error connecting to the AI. Please check the console for details.";
            }
        };


const displayMessage = (template, text) => {
    const messageNode = template.cloneNode(true);
    messageNode.removeAttribute('id');
    messageNode.classList.remove('hidden');
    if (text) {
         messageNode.querySelector('p').textContent = text;
    }
    chatContainer.appendChild(messageNode);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageNode;
}

const sendMessage = async () => {
    const messageText = messageInput.value.trim();
    if (messageText === '') return;

    displayMessage(userMessageTemplate, messageText);
    messageInput.value = '';
    
    const typingIndicator = displayMessage(typingIndicatorTemplate);
    
    const botResponseText = await callGeminiAPI(messageText);
    
    chatContainer.removeChild(typingIndicator);
    displayMessage(botMessageTemplate, botResponseText);
};

const suggestReplies = async () => {
    const lastMessage = chatHistory[chatHistory.length - 1]?.parts[0]?.text;
    if(!lastMessage) {
        displayMessage(botMessageTemplate, "There's no message to reply to!");
        return;
    }

    const prompt = `Based on the last message in the conversation ("${lastMessage}"), suggest three distinct, short, and natural-sounding replies a user could send next. Format the output as a numbered list.`;

    const typingIndicator = displayMessage(typingIndicatorTemplate);

    const suggestionsResponse = await callGeminiAPI(prompt);
    
    chatContainer.removeChild(typingIndicator);
    displayMessage(botMessageTemplate, `Here are some suggested replies:\n\n${suggestionsResponse}`);
}

// --- Voice Button Event Listener (Updated MimeType) ---
voiceBtn.addEventListener('click', async () => {
    if (isRecording) {
        // STOP Recording
        voiceBtn.style.color = ''; 
        voiceBtn.innerHTML = '🎤'; 
        isRecording = false;
        
        if (mediaRecorder) {
            mediaRecorder.stop();
        }

    } else {
        // START Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' }); 
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
                stream.getTracks().forEach(track => track.stop()); 
                uploadAudioForTranscription(audioBlob);
            };

            // Start recording
            mediaRecorder.start();
            voiceBtn.style.color = 'red'; 
            voiceBtn.innerHTML = '🔴'; 
            isRecording = true;
            
            // --- MODIFICATION ---
            // Updated the prompt for English-only
            displayMessage(botMessageTemplate, "🔴 **Recording...** Click the voice button again to stop. Please speak clearly in English.");
            // --- END MODIFICATION ---

        } catch (error) {
            console.error('Microphone access denied or error:', error);
            displayMessage(botMessageTemplate, `**❌ Error:** Could not access the microphone. Please check your browser permissions. ${error.message}`);
        }
    }
});


sendBtn.addEventListener('click', sendMessage);
suggestBtn.addEventListener('click', suggestReplies);

messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

// --- Attachment Button Logic ---
attachmentBtn.addEventListener('click', () => {
    fileInputHidden.value = null;
    fileInputHidden.click(); 
});

fileInputHidden.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        if (file.name.toLowerCase().endsWith(".pdf")) {
            uploadFileToBackend(file);
        } else {
            displayMessage(botMessageTemplate, "⚠️ **Invalid File:** Please select a PDF file.");
        }
    }
});