from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles 
from pathlib import Path

app = FastAPI()

# -----------------------------------------------------------
# ⭐ CRITICAL: The ABSOLUTE path to your Frontend-new directory.
# This MUST be correct for static files to load.
# -----------------------------------------------------------
# Replace the placeholder path with your actual path:
ABSOLUTE_FRONTEND_PATH = Path("C:/Users/admin/Desktop/RAG(Model)/Frontend-new")
# -----------------------------------------------------------

# Define the directory where files will be stored (within Backend-new)
# This creates C:\Users\admin\Desktop\RAG(Model)\Backend-new\pdf
PDF_FOLDER = Path(__file__).parent / "pdf"
PDF_FOLDER.mkdir(exist_ok=True) 

# --- CRITICAL FIX: Mount the 'Frontend-new' folder to the '/static' URL ---
# This makes C:/.../Frontend-new/script.js accessible at /static/script.js
try:
    # We are mounting the CONTENT of ABSOLUTE_FRONTEND_PATH to the URL prefix /static
    app.mount("/static", StaticFiles(directory=ABSOLUTE_FRONTEND_PATH), name="static")
    print(f"INFO: Successfully mounted Frontend-new to the /static URL path.")
except RuntimeError as e:
    print(f"FATAL ERROR: StaticFiles could not find the directory at: {ABSOLUTE_FRONTEND_PATH}")
    raise e 

# -----------------------------------------------------------
# Endpoints
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