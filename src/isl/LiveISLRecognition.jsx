
import { useEffect, useRef, useState } from "react";
import GestureRecognition from "../components/GestureRecognition";
import { classifyGesture } from "./gestureClassifier";

const RECORDING_DURATION = 3000;
const KANNADA_TTS_URL = "http://127.0.0.1:8000/speak";

const COMMUNICATION_MESSAGES = {
  WATER: {
    "en-IN": "I need water.",
    "kn-IN": "ನನಗೆ ನೀರು ಬೇಕು.",
    "hi-IN": "मुझे पानी चाहिए।",
  },
  FOOD: {
    "en-IN": "I need food.",
    "kn-IN": "ನನಗೆ ಆಹಾರ ಬೇಕು.",
    "hi-IN": "मुझे खाना चाहिए।",
  },
  THANK_YOU: {
    "en-IN": "Thank you.",
    "kn-IN": "ಧನ್ಯವಾದಗಳು.",
    "hi-IN": "धन्यवाद।",
  },
  YES: {
    "en-IN": "Yes.",
    "kn-IN": "ಹೌದು.",
    "hi-IN": "हाँ।",
  },
  NO: {
    "en-IN": "No.",
    "kn-IN": "ಇಲ್ಲ.",
    "hi-IN": "नहीं।",
  },
};

const LANGUAGE_NAMES = {
  "en-IN": "English",
  "kn-IN": "Kannada",
  "hi-IN": "Hindi",
};

function LiveISLRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState("en-IN");
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [availableVoices, setAvailableVoices] = useState([]);

  const framesRef = useRef([]);
  const recordingStartRef = useRef(null);
  const timerRef = useRef(null);
  const finishedRef = useRef(false);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  useEffect(() => {
    function loadVoices() {
      if (window.speechSynthesis) {
        setAvailableVoices(window.speechSynthesis.getVoices());
      }
    }

    loadVoices();

    if (window.speechSynthesis) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        loadVoices
      );
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          loadVoices
        );
        window.speechSynthesis.cancel();
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  function stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setSpeaking(false);
  }

  function handleLandmarks(frame) {
    if (!isRecording || finishedRef.current) return;

    if (frame.bothHands) {
      framesRef.current.push(frame);
    }
  }

  function finishRecording() {
    if (finishedRef.current) return;

    finishedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setCountdown(0);

    const capturedFrames = [...framesRef.current];

    if (capturedFrames.length < 5) {
      setResult(null);
      setSpeechError(
        "Not enough hand movement was recorded. Keep both hands visible and try again."
      );
      return;
    }

    const classified = classifyGesture(capturedFrames);

    if (!classified) {
      setResult(null);
      setSpeechError(
        "Could not recognize the gesture. Please try again."
      );
      return;
    }

    const message =
      COMMUNICATION_MESSAGES[classified.label] || {
        "en-IN": "Gesture detected, but no message is available.",
        "kn-IN": "ಸನ್ನೆ ಗುರುತಿಸಲಾಗಿದೆ, ಆದರೆ ಸಂದೇಶ ಲಭ್ಯವಿಲ್ಲ.",
        "hi-IN": "इशारा पहचाना गया, लेकिन संदेश उपलब्ध नहीं है।",
      };

    setResult({
      ...classified,
      message,
    });

    setConfirmed(false);
    setSpeechError("");
  }

  function startRecording() {
    stopSpeaking();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    framesRef.current = [];
    recordingStartRef.current = performance.now();
    finishedRef.current = false;

    setResult(null);
    setConfirmed(false);
    setSpeechError("");
    setCountdown(3);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      const elapsed =
        performance.now() - recordingStartRef.current;

      const remaining = Math.max(
        0,
        Math.ceil((RECORDING_DURATION - elapsed) / 1000)
      );

      setCountdown(remaining);

      if (elapsed >= RECORDING_DURATION) {
        finishRecording();
      }
    }, 50);
  }

  async function speakMessage(message, language = speechLanguage) {
    if (!message) return;

    stopSpeaking();
    setSpeechError("");

    // Kannada uses the local FastAPI + Edge TTS server.
    if (language === "kn-IN") {
      try {
        const response = await fetch(KANNADA_TTS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: message,
          }),
        });

        if (!response.ok) {
          let errorMessage = `Kannada speech server returned error ${response.status}.`;

          try {
            const errorData = await response.json();
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } catch {
            // Keep the original error message.
          }

          throw new Error(errorMessage);
        }

        const audioBlob = await response.blob();

        if (!audioBlob.size) {
          throw new Error("The Kannada audio file is empty.");
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeaking(false);
          audioRef.current = null;

          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        };

        audio.onerror = () => {
          setSpeaking(false);
          setSpeechError("Unable to play the Kannada audio.");
          audioRef.current = null;

          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        };

        await audio.play();
        setSpeaking(true);
        return;
      } catch (error) {
        console.error("Kannada TTS error:", error);
        setSpeaking(false);
        setSpeechError(
          `Kannada speech failed: ${error.message}. Check that the Python speech server is running on port 8000.`
        );
        return;
      }
    }

    // English and Hindi use browser speech synthesis.
    if (!window.speechSynthesis) {
      setSpeechError(
        "Your browser does not support text-to-speech."
      );
      return;
    }

    const synth = window.speechSynthesis;
    const speech = new SpeechSynthesisUtterance(message);

    speech.lang = language;

    const languageCode = language.split("-")[0].toLowerCase();

    const matchingVoice =
      availableVoices.find(
        (voice) =>
          voice.lang.toLowerCase() === language.toLowerCase()
      ) ||
      availableVoices.find(
        (voice) =>
          voice.lang.toLowerCase().startsWith(languageCode + "-")
      ) ||
      availableVoices.find(
        (voice) => voice.lang.toLowerCase() === languageCode
      );

    if (matchingVoice) {
      speech.voice = matchingVoice;
    }

    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    speech.onstart = () => {
      setSpeaking(true);
      setSpeechError("");
    };

    speech.onend = () => {
      setSpeaking(false);
    };

    speech.onerror = (event) => {
      setSpeaking(false);

      if (
        event.error !== "canceled" &&
        event.error !== "interrupted"
      ) {
        setSpeechError(
          `Speech could not be played in ${LANGUAGE_NAMES[language]}.`
        );
      }
    };

    synth.speak(speech);
  }

  function confirmMessage() {
    if (!result) return;

    setConfirmed(true);

    const message = result.message[speechLanguage];

    speakMessage(message, speechLanguage);
  }

  const selectedMessage = result
    ? result.message[speechLanguage]
    : "";

  return (
    <div
      style={{
        maxWidth: 850,
        margin: "20px auto",
        padding: 20,
        backgroundColor: "transparent",
        borderRadius: 15,
        color: "#000000",
      }}
    >
      <h2 style={{ textAlign: "center" }}>
        ISL Recognition
      </h2>

      <p style={{ textAlign: "center" }}>
        Record your hand gesture and convert it into text and speech.
      </p>

      <GestureRecognition onHandLandmarks={handleLandmarks} />

      <section
        style={{
          marginTop: 20,
          padding: 20,
          border: "1px solid #dddddd",
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <h3>Gesture Recording</h3>

        <p>
          <strong>Status:</strong>{" "}
          {isRecording
            ? "Recording..."
            : result
              ? "Recording completed."
              : "Ready to record."}
        </p>

        {isRecording && (
          <h2 style={{ fontSize: 35 }}>{countdown}</h2>
        )}

        <button
          onClick={startRecording}
          disabled={isRecording}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            backgroundColor: isRecording ? "#999" : "#795548",
            color: "white",
            cursor: isRecording ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {isRecording
            ? "Recording..."
            : "Start 3-Second Recording"}
        </button>

        {result && (
          <button
            onClick={startRecording}
            style={{
              marginLeft: 10,
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#8D6E63",
              color: "white",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Try Again
          </button>
        )}

        {speechError && !result && (
          <p style={{ color: "#B71C1C" }}>{speechError}</p>
        )}
      </section>

      {result && (
        <section
          style={{
            marginTop: 20,
            padding: 20,
            backgroundColor: "#FFF4D6",
            border: "1px solid #D8C69A",
            borderRadius: 12,
            color: "#3D3023",
          }}
        >
          <h3 style={{ textAlign: "center" }}>
            Recognition Result
          </h3>

          <p>
            <strong>Detected Gesture:</strong> {result.label}
          </p>

          <p>
            <strong>Distance:</strong>{" "}
            {result.distance.toFixed(4)}
          </p>

          <p>
            <strong>Reference Recording:</strong>{" "}
            {result.reference}
          </p>

          <hr />

          <h3 style={{ textAlign: "center" }}>
            Suggested Communication Message
          </h3>

          <div
            style={{
              padding: 20,
              margin: "15px 0",
              backgroundColor: "#FFF0CC",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 24,
              fontWeight: "bold",
            }}
          >
            {selectedMessage}
          </div>

          <label>
            <strong>Select Speech Language:</strong>
          </label>

          <select
            value={speechLanguage}
            onChange={(event) => {
              stopSpeaking();
              setSpeechLanguage(event.target.value);
              setConfirmed(false);
              setSpeechError("");
            }}
            style={{
              display: "block",
              width: "100%",
              padding: 12,
              marginTop: 10,
              marginBottom: 15,
              borderRadius: 8,
              fontSize: 16,
            }}
          >
            <option value="en-IN">English</option>
            <option value="kn-IN">Kannada</option>
            <option value="hi-IN">Hindi</option>
          </select>

          <p>
            <strong>Available browser voices:</strong>{" "}
            {availableVoices.length}
          </p>

          <p>
            <strong>Message status:</strong>{" "}
            {confirmed
              ? "Message confirmed."
              : "Waiting for confirmation."}
          </p>

          <div style={{ textAlign: "center", marginTop: 15 }}>
            <button
              onClick={confirmMessage}
              style={{
                padding: "12px 22px",
                margin: 5,
                border: "none",
                borderRadius: 8,
                backgroundColor: "#4CAF50",
                color: "white",
                cursor: "pointer",
              }}
            >
              {confirmed
                ? "Confirmed — Speak Again"
                : "Confirm Message & Speak"}
            </button>

            <button
              onClick={() =>
                speakMessage(selectedMessage, speechLanguage)
              }
              style={{
                padding: "12px 22px",
                margin: 5,
                border: "none",
                borderRadius: 8,
                backgroundColor: "#795548",
                color: "white",
                cursor: "pointer",
              }}
            >
              Speak Again
            </button>

            {speaking && (
              <button
                onClick={stopSpeaking}
                style={{
                  padding: "12px 22px",
                  margin: 5,
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: "#C62828",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Stop Speech
              </button>
            )}
          </div>

          {speechError && (
            <p
              style={{
                color: "#B71C1C",
                textAlign: "center",
                marginTop: 15,
              }}
            >
              {speechError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default LiveISLRecognition;
