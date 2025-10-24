document.addEventListener('DOMContentLoaded', () => {
    const pdfInput = document.getElementById('pdf-input');
    const uploadBtn = document.getElementById('upload-btn');
    const statusMessage = document.getElementById('status-message');
    const fileNameDisplay = document.getElementById('file-name-display'); // Get the new text span

    // Check if all elements exist
    if (!pdfInput || !uploadBtn || !statusMessage || !fileNameDisplay) {
        console.error("Upload script error: One or more required elements (pdf-input, upload-btn, status-message, file-name-display) are missing.");
        if (statusMessage) {
            statusMessage.textContent = "Page error. Please refresh.";
        }
        return;
    }

    // --- NEW: Add event listener to the file input itself ---
    // This updates the UI to show what file was selected
    pdfInput.addEventListener('change', () => {
        if (pdfInput.files.length > 0) {
            const fileName = pdfInput.files[0].name;
            fileNameDisplay.textContent = fileName;
            statusMessage.textContent = ''; // Clear any old errors
        } else {
            fileNameDisplay.textContent = 'None';
        }
    });

    // --- This is the logic for the "Upload and Start Chat" button ---
    uploadBtn.addEventListener('click', async () => {
        const file = pdfInput.files[0]; // Get the file

        if (!file) {
            statusMessage.textContent = '⚠️ Please select a file first.';
            return;
        }

        // The 'accept' attribute on the input handles this, but 
        // this is a good final check.
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            statusMessage.textContent = '⚠️ Invalid File: Please select a PDF file.';
            return;
        }

        // Disable button and show status
        uploadBtn.disabled = true;
        statusMessage.textContent = `Uploading ${file.name}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch('/upload-pdf/', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.detail || 'Upload failed due to a server error.';
                statusMessage.textContent = `❌ Upload Failed: ${errorMessage}`;
                uploadBtn.disabled = false; // Re-enable button on failure
                return;
            }

            // On success
            statusMessage.textContent = '✅ Upload successful! Redirecting to chat...';
            
            // Wait 1.5 seconds so the user can see the success message
            setTimeout(() => {
                window.location.href = '/chat'; // Redirect to the chat page
            }, 1500);

        } catch (error) {
            statusMessage.textContent = '⚠️ Network Error: Could not connect to the server.';
            console.error('Upload Error:', error);
            uploadBtn.disabled = false; // Re-enable button on failure
        }
    });
});