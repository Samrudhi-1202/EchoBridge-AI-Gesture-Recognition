
import { useState } from "react";

function TextToSpeech() {
  const [language, setLanguage] = useState("en-IN");
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState(null);

  const languages = [
    { code: "en-IN", name: "English (India)" },
    { code: "kn-IN", name: "Kannada" },
    { code: "hi-IN", name: "Hindi" },
  ];

  async function speakText() {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    setError("");

    if (language === "kn-IN") {
      try {
        const response = await fetch("http://127.0.0.1:8000/speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error("Kannada speech generation failed.");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const newAudio = new Audio(audioUrl);

        setAudio(newAudio);
        setSpeaking(true);

        newAudio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        newAudio.onerror = () => {
          setSpeaking(false);
          setError("Unable to play Kannada audio.");
          URL.revokeObjectURL(audioUrl);
        };

        await newAudio.play();
      } catch (err) {
        setSpeaking(false);
        setError("Kannada speech error: " + err.message);
      }

      return;
    }

    if (!("speechSynthesis" in window)) {
      setError("Text-to-Speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = language;
    speech.rate = 1;
    speech.pitch = 1;

    speech.onstart = () => setSpeaking(true);
    speech.onend = () => setSpeaking(false);
    speech.onerror = (event) => {
      setSpeaking(false);
      setError("Speech error: " + event.error);
    };

    window.speechSynthesis.speak(speech);
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setSpeaking(false);
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
      <h2>Text-to-Speech</h2>
      <p>Select the language:</p>

      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        disabled={speaking}
        style={{ padding: 10, width: "100%" }}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>

      <h3>Enter Text</h3>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type something to hear it spoken..."
        rows={5}
        style={{
          width: "100%",
          padding: 10,
          boxSizing: "border-box",
        }}
      />

      <div style={{ marginTop: 15 }}>
        <button onClick={speakText} disabled={speaking}>
          🔊 Speak
        </button>

        <button
          onClick={stopSpeaking}
          disabled={!speaking}
          style={{ marginLeft: 10 }}
        >
          ⏹ Stop
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </section>
  );
}

export default TextToSpeech;
