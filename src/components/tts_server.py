
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import asyncio
import tempfile
import os
import sys

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SpeechRequest(BaseModel):
    text: str

@app.post("/speak")
async def speak(request: SpeechRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    file_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".mp3", delete=False
        ) as temp_file:
            file_path = temp_file.name

        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "edge_tts",
            "--text",
            request.text,
            "--voice",
            "kn-IN-SapnaNeural",
            "--write-media",
            file_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise Exception(stderr.decode(errors="replace"))

        with open(file_path, "rb") as audio_file:
            audio_data = audio_file.read()

        if not audio_data:
            raise Exception("The MP3 file is empty.")

        return Response(
            content=audio_data,
            media_type="audio/mpeg"
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

@app.get("/")
def home():
    return {"message": "EchoBridge Kannada TTS is running"}
