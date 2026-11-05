from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import edge_tts

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

    try:
        audio = bytearray()

        communicate = edge_tts.Communicate(
            request.text,
            voice="kn-IN-SapnaNeural"
        )

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])

        return Response(
            content=bytes(audio),
            media_type="audio/mpeg"
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/")
def home():
    return {"message": "EchoBridge Kannada TTS is running"}