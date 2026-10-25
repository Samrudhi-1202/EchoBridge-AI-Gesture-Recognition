
import { useState } from "react";
import GestureRecognition from "./components/GestureRecognition";
import LiveISLRecognition from "./isl/LiveISLRecognition";
import IndependentTest from "./isl/IndependentTest";

function App() {
  const [confirmedGestures, setConfirmedGestures] = useState({});
  const [mode, setMode] = useState("basic");

  function handleGestureConfirmed(data) {
    console.log("Confirmed gesture:", data);

    setConfirmedGestures((previous) => ({
      ...previous,
      [data.hand]: {
        gesture: data.gesture,
        timestamp: data.timestamp,
      },
    }));
  }

  function clearResults() {
    setConfirmedGestures({});
  }

  return (
    <main>
      <h1 style={{ textAlign: "center" }}>EchoBridge AI</h1>

      <div
        style={{
          textAlign: "center",
          margin: 20,
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <button
          onClick={() => setMode("basic")}
          disabled={mode === "basic"}
        >
          Basic Gesture Test
        </button>

        <button
          onClick={() => setMode("isl")}
          disabled={mode === "isl"}
        >
          ISL Recognition
        </button>

        <button
          onClick={() => setMode("test")}
          disabled={mode === "test"}
        >
          Independent Test
        </button>
      </div>

      {mode === "basic" ? (
        <>
          <GestureRecognition
            onGestureConfirmed={handleGestureConfirmed}
          />

          <section
            style={{
              maxWidth: 600,
              margin: "20px auto",
              padding: 20,
              border: "1px solid #888",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <h2>Integration Test</h2>

            {Object.keys(confirmedGestures).length === 0 ? (
              <p>Waiting for confirmed gestures...</p>
            ) : (
              Object.entries(confirmedGestures).map(
                ([hand, data]) => (
                  <div
                    key={hand}
                    style={{
                      padding: 15,
                      marginBottom: 12,
                      border: "1px solid #888",
                      borderRadius: 10,
                    }}
                  >
                    <h3>{hand} Hand</h3>

                    <p>
                      <strong>Gesture:</strong> {data.gesture}
                    </p>

                    <p>
                      <strong>Event received:</strong> Successfully
                    </p>
                  </div>
                )
              )
            )}

            <button onClick={clearResults}>
              Clear Results
            </button>
          </section>
        </>
      ) : mode === "isl" ? (
        <LiveISLRecognition />
      ) : (
        <IndependentTest />
      )}
    </main>
  );
}

export default App;
