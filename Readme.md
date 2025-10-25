# Multimodal RAG PDF Chatbot
This project is a full-stack web application that allows you to "chat" with your PDF documents.

What makes this project unique is its multimodal RAG (Retrieval-Augmented Generation) pipeline. It doesn't just read the text from your PDFs; it also uses a Vision-Language Model (VLM) to analyze any images, charts, or figures within the document. These image descriptions are embedded alongside the text, allowing you to ask questions about both the text and the visual content of your documents.

The application uses a FastAPI backend, a ChromaDB vector store, and a modern vanilla JS + Tailwind CSS frontend.   

## Features
* PDF Upload: A clean web interface to upload your PDF documents.

* Automated Multimodal Pipeline: When a PDF is uploaded, it  automatically:

    1. converts the PDF to Markdown using `marker`.

    2.  Extracts all images.

    3. Analyzes each image using an Ollama Vision-Language Model (`qwen3-vl:235b-cloud`) to generate a rich description.

    4. Embeds the text and image descriptions into a ChromaDB vector store using `BAAI/bge-large-en-v1.5`.

* Chat Interface: A responsive chat UI to ask questions about your uploaded document.

* Document-Specific Context: Each uploaded PDF gets its own  vector collection, so conversations are always in context.

* Speech-to-Text: A voice input button in the chat transcribes your speech to text for hands-free querying.

### How It Works

The application is split into two main processes: Ingestion and Chat.

1. PDF Ingestion Pipeline (Backend)

    When you upload a PDF via the `/upload-pdf` endpoint:

    1. The file is saved to the `/pdf` folder.

    2. A background task is triggered in `main.py` which runs three scripts in sequence:

        *  `Base.py`: Uses `marker` to convert the PDF into a clean Markdown file and extracts all associated images into a new directory (e.g., my_document_name/).

        * `Image-Testo.py`: Scans the newly created Markdown file. When it finds an image link (eg:`_page_4_Figure_2.jpeg`), it sends that image to the Ollama VLM (qwen3-vl:235b-cloud) for analysis. The script then replaces the image link with a detailed text description (e.g., > **Image Description:** A bar chart...).

        * `Emmbed.py`: Takes the final, text-rich Markdown file (now containing image descriptions), splits it into chunks, and uses the `BAAI/bge-large-en-v1.5` model to generate embeddings. These embeddings are stored in a persistent ChromaDB collection, with the collection name based on the original PDF filename.

2. Chat (RAG) Process (Frontend + Backend)

    1. Frontend (`script.js`): When you send a message, the frontend makes a POST request to the `/chat/` endpoint, sending your message and the `collection_name` (which was stored in `sessionStorage` after upload).

    2. Backend (`rag_components.py`):

        * The backend loads the powerful Ollama Cloud LLM (`gpt-oss:120b`).

        * It dynamically builds a RAG chain using LangChain.

        * It takes your question and queries the specified ChromaDB collection to find the most relevant text or image description chunks.

        * It passes these retrieved chunks (the context) and your question to the LLM.

    3. Response: The LLM generates an answer based only on the provided context, and the frontend displays this answer to you.

### Tech Stack

* Backend:
    
    * Framework: FastAPI
     
    * LLM (Chat): Ollama Cloud (`gpt-oss:120b`)
    
    * VLM (Image Analysis): Ollama Cloud (`qwen3-vl:235b-cloud`)
    
    * Embeddings: `BAAI/bge-large-en-v1.5` (via `l angchain-huggingface`)
    
    * RAG: LangChain
    * Vector Store: ChromaDB (persistent)
    
    * PDF Parsing: `marker-pdf-converter`
    
    * STT: `speechrecognition`
    
* Frontend:

    * HTML, CSS, Vanilla JavaScript

    * Tailwind CSS (for styling)

## Setup and Installation

### Prerequisites

* Python 3.10+

* An Ollama API Key (since this project uses the Ollama Cloud models).

* FFmpeg (for audio processing). Install it via your system's package manager (e.g., `brew install ffmpeg`, `apt-get install ffmpeg`).

1. Clone the Repository

    ```shell
    git clone https://github.com/Pager-dot/RAG-Model.git

    cd RAG-Model
    ```
2. Set Up the Backend
    1. Navigate to the backend directory:
        ```shell
        cd Backend-new
        ```
    2. (Recommended) Create and activate a virtual environment:
        ```shell
        python -m venv venv
        source venv/bin/activate  # On Windows: venv\Scripts\activate
        ```
    3. Install the required Python packages. (A `requirements.txt` is not provided, but you can install the main dependencies manually):
        ```shell 
        pip install "fastapi[all]" uvicorn langchain langchain-ollama langchain-huggingface langchain-chroma chromadb sentence-transformers torch python-dotenv "marker-pdf-converter[torch]" speechrecognition pydub sounddevice
        ```
        Note: `marker-pdf-converter` requires `torch`. Ensure you have the correct PyTorch version for your hardware (CPU or CUDA).

    4. Create a `.env` file in the `Backend-new/` directory:
        ```shell
        touch .env
        ```
    5. Add your Ollama API key to the `.env` file:
        ```shell
        OLLAMA_API_KEY="your_ollama_api_key_goes_here"
        ```
3. Run the Application
    1. From the `Backend-new/` directory, start the FastAPI server:
        ```shell 
        uvicorn main:app --reload
        ```
        The `--reload` flag is for development and automatically restarts the server when code changes.
    2. Open your browser and navigate to: `http://127.0.0.1:8000`

        You will see the PDF upload page. Upload a document, wait for it to be processed, and you will be redirected to the chat page, ready to ask questions.

## Project Structure

```bash
├── .gitignore
├── Backend-new/
│   ├── main.py             # FastAPI server: endpoints for upload, chat, STT
│   ├── rag_components.py   # Loads LLM/Embedding models, builds the RAG chain
│   │
│   ├── Base.py             # Pipeline Script 1: PDF -> Markdown + Images
│   ├── Image-Testo.py      # Pipeline Script 2: Analyzes images using Ollama VLM
│   ├── Emmbed.py           # Pipeline Script 3: Embeds final MD -> ChromaDB
│   │
│   ├── chroma_db/          # Default directory for the persistent vector store
│   ├── pdf/                # Default directory for uploaded PDFs
│   ├── .env                # (You must create this) Stores API keys
│   │
│   ├── STT.py              # Standalone test for Speech-to-Text
│   ├── TTS.py              # Standalone test for Text-to-Speech
│   ├── Testo.py            # Test script for the Ollama Cloud RAG chain
│   ├── test.py             # Test script for a local (HuggingFace) RAG chain
│   └── Image-Test.py       # Standalone test for a local VLM
│
└── Frontend-new/
    ├── upload.html         # PDF upload page
    ├── index.html          # Main chat interface
    ├── style.css           # Custom styles (e.g., typing indicator)
    ├── script.js           # Chat page logic (sending messages, STT)
    └── upload.js           # Upload page logic (handling file upload, redirecting)


```

