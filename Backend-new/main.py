from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles 
from pathlib import Path
import speech_recognition as sr
import io
from pydub import AudioSegment

app = FastAPI()

# -----------------------------------------------------------
# CRITICAL: Configure the path to your Frontend directory.
# -----------------------------------------------------------
ABSOLUTE_FRONTEND_PATH = Path(__file__).parent.parent / "Frontend-new"

# Define the directory where files will be stored (within the backend folder)
PDF_FOLDER = Path(__file__).parent / "pdf"
PDF_FOLDER.mkdir(exist_ok=True) 

# --- Mount the Frontend folder to the '/static' URL ---
try:
    app.mount("/static", StaticFiles(directory=ABSOLUTE_FRONTEND_PATH), name="static")
    print(f"INFO: Successfully mounted Frontend to the /static URL path.")
except RuntimeError as e:
    print(f"FATAL ERROR: StaticFiles could not find the directory at: {ABSOLUTE_FRONTEND_PATH}")
    raise e 

# -----------------------------------------------------------
# Utility Function (FOR ENGLISH-ONLY)
# -----------------------------------------------------------

def transcribe_and_translate_audio(audio_content: bytes) -> dict:
    """
    Robust English-only transcription.
      - Transcribes spoken English.
      - Returns: {"text_english": "<text>"}
    """
    r = sr.Recognizer()

    # --- 1. Convert audio bytes to WAV (mono, 22050 Hz) ---
    try:
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_content))
        wav_buffer = io.BytesIO()
        audio_segment.export(
            wav_buffer, format="wav", parameters=["-ac", "1", "-ar", "22050"]
        )
        wav_buffer.seek(0)
        with sr.AudioFile(wav_buffer) as source:
            audio = r.record(source)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid audio file format (Conversion error): {e}"
        )

    text_transcribed = None

    # --- 2. Try English transcription ---
    try:
        # Attempt to recognize the speech as English
        text_transcribed = r.recognize_google(audio, language="en-US")
    
    except sr.UnknownValueError:
        # No recognizable speech
        return {"text_english": "Could not understand audio. Please speak clearly."}
    except sr.RequestError as e:
        # API is unreachable or returned an error
        raise HTTPException(status_code=503, detail=f"Speech API error: {e}")
    except Exception as e:
        # Any other unexpected failure
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    # --- 3. Return the transcribed text ---
    return {"text_english": text_transcribed}
# -----------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_index_html():
    """Reads and serves the index.html file."""
    index_file_path = ABSOLUTE_FRONTEND_PATH / "index.html"
    if not index_file_path.exists():
        return HTMLResponse(status_code=404, content="<h1>404 Not Found</h1><p>index.html not found at the configured path.</p>")
    
    with open(index_file_path, 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())


@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    """Receives a file and stores it in the pdf/ folder."""
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        
        file_path = PDF_FOLDER / file.filename
        
        with open(file_path, "wb") as buffer:
            while content := await file.read(1024 * 1024):  
                buffer.write(content)

        return {"filename": file.filename, "message": "File uploaded successfully", "path": str(file_path)}
        
    except Exception as e:
        print(f"Error during file upload: {e}")
        raise HTTPException(status_code=500, detail=f"Could not upload file: {e}")


@app.post("/transcribe-audio/")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """Receives an audio file, converts it, and transcribes it (English-only)."""
    
    try:
        # 1. Read the audio file content into memory
        audio_content = await audio_file.read()

        # 2. Process the audio content
        result = transcribe_and_translate_audio(audio_content)
        
        return result
        
    except HTTPException as h:
        raise h
    except Exception as e:
        print(f"Error during audio transcription: {e}")
        raise HTTPException(status_code=500, detail=f"Could not process audio: {e}")