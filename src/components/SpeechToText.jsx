
import { useRef, useState } from "react";

function SpeechToText() {
  const [language, setLanguage] = useState("en-IN");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);

  const languages = [
    { code: "en-IN", name: "English (India)" },
    { code: "kn-IN", name: "Kannada" },
    { code: "hi-IN", name: "Hindi" },
  ];

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported. Please try Google Chrome.");
      return;
    }

    setError("");
    setInterim("");

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interimText += text;
        }
      }

      if (finalText) {
        setTranscript((previous) => previous + finalText);
      }

      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      setError("Speech recognition error: " + event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      setError("Could not start microphone: " + err.message);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setListening(false);
  }

  function clearTranscript() {
    setTranscript("");
    setInterim("");
    setError("");
  }

  return (
    <section
      style={{
        maxWidth: 600,
        margin: "25px auto",
        padding: 20,
        border: "1px solid #888",
        borderRadius: 12,
      }}
    >
      <h2>Speech-to-Text</h2>

      <p>Select your speaking language:</p>

      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        disabled={listening}
        style={{ padding: 10, width: "100%" }}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 20 }}>
        {!listening ? (
          <button onClick={startListening}>🎤 Start Speaking</button>
        ) : (
          <button onClick={stopListening}>⏹ Stop Speaking</button>
        )}
      </div>

      <h3>Recognized Text</h3>

      <div
        style={{
          minHeight: 100,
          padding: 12,
          border: "1px solid #aaa",
          borderRadius: 8,
          overflowWrap: "break-word",
        }}
      >
        {transcript}
        <span style={{ color: "#777" }}>{interim}</span>

        {!transcript && !interim && (
          <span style={{ color: "#888" }}>
            Your speech will appear here...
          </span>
        )}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={clearTranscript} style={{ marginTop: 15 }}>
        Clear Text
      </button>
    </section>
  );
}

export default SpeechToText;
