const chatContainer = document.getElementById('chat-container');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const voiceBtn = document.getElementById('voice-btn');
        const attachmentBtn = document.getElementById('attachment-btn');
        const fileInputHidden = document.createElement('input'); 
        fileInputHidden.type = 'file';
        fileInputHidden.accept = '.pdf'; // Restrict to PDF files
        fileInputHidden.style.display = 'none';
        document.body.appendChild(fileInputHidden); // Append it to the body
        const suggestBtn = document.getElementById('suggest-btn');

        const userMessageTemplate = document.getElementById('user-message-template');
        const botMessageTemplate = document.getElementById('bot-message-template');
        const typingIndicatorTemplate = document.getElementById('typing-indicator-template');
        
        const chatHistory = [{
            role: "model",
            parts: [{ text: "You are a helpful and friendly AI assistant." }]
        }];
        const uploadFileToBackend = async (file) => {
        // 1. Display a status message
        const uploadStatus = displayMessage(botMessageTemplate, `**Uploading File:** ${file.name} (Type: ${file.type}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
            
        const formData = new FormData();
        // The key 'file' must match the parameter name in the FastAPI endpoint
        formData.append("file", file); 

        try {
            // This is the correct endpoint for the FastAPI server
            const response = await fetch('/upload-pdf/', {
                method: 'POST',
                body: formData 
            });

        // Remove the original status message (optional: you can update it instead)
            chatContainer.removeChild(uploadStatus);

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.detail || 'Upload failed due to a server error.';
                displayMessage(botMessageTemplate, `**❌ Upload Failed:** ${errorMessage}`);
                return;
            }

            const data = await response.json();
            // 2. Display the successful message in the chat
            const successMessage = `**✅ File Uploaded Successfully!**\nFilename: ${data.filename}\nPath: ${data.path}`;
            displayMessage(botMessageTemplate, successMessage);
        
        } catch (error) {
            // Remove the original status message
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

        sendBtn.addEventListener('click', sendMessage);
        suggestBtn.addEventListener('click', suggestReplies);
        
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
        
        // --- Placeholder functionality for other buttons ---
        voiceBtn.addEventListener('click', () => {
             displayMessage(botMessageTemplate, "Voice input is not yet supported in this demo.");
        });

        attachmentBtn.addEventListener('click', () => {
        // 1. Clear any previous selection and trigger the file dialog
        fileInputHidden.value = null; // Important to allow selecting the same file again
        fileInputHidden.click(); 
});

        // 2. Add an event listener to the HIDDEN file input element
        fileInputHidden.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
        // Check file type validation (already set in accept=".pdf" but good to double-check)
            if (file.name.toLowerCase().endsWith(".pdf")) {
                uploadFileToBackend(file);
            } else {
                displayMessage(botMessageTemplate, "⚠️ **Invalid File:** Please select a PDF file.");
            }
        }
    });