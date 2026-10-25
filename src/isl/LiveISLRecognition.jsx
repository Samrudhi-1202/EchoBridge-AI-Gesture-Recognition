
import { useRef, useState } from "react";
import GestureRecognition from "../components/GestureRecognition";
import {
  classifyGesture,
  getModelInfo,
} from "./gestureClassifier";

const RECORDING_DURATION = 3000;
const SAMPLE_INTERVAL = 100;

const COMMUNICATION_MESSAGES = {
  WATER: "I need water.",
  THANK_YOU: "Thank you.",
  YES: "Yes.",
  NO: "No.",
  FOOD: "I need food.",
};

export default function LiveISLRecognition() {
  const recordingRef = useRef(null);
  const lastSampleRef = useRef(0);

  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const [message, setMessage] = useState(
    "Start the camera, then record a gesture."
  );

  const modelInfo = getModelInfo();

  function handleLandmarks(frame) {
    const session = recordingRef.current;
    if (!session) return;

    if (
      frame.time - lastSampleRef.current <
      SAMPLE_INTERVAL
    ) {
      return;
    }

    lastSampleRef.current = frame.time;

    session.frames.push({
      time: frame.time - session.startTime,
      hands: frame.hands,
      bothHands: frame.bothHands,
    });

    if (
      frame.time - session.startTime <
      RECORDING_DURATION
    ) {
      return;
    }

    recordingRef.current = null;
    setRecording(false);

    const frames = session.frames;

    const bothHandsCount = frames.filter(
      (item) => item.bothHands
    ).length;

    const detectionRate = frames.length
      ? Math.round(
          (bothHandsCount / frames.length) * 100
        )
      : 0;

    if (detectionRate < 60) {
      setResult(null);
      setConfirmed(false);
      setMessage(
        `Both hands detected in only ${detectionRate}% of frames. Please try again.`
      );
      return;
    }

    const prediction = classifyGesture(frames);

    if (!prediction) {
      setResult(null);
      setConfirmed(false);
      setMessage(
        "Not enough valid landmark data."
      );
      return;
    }

    setResult(prediction);
    setConfirmed(false);

    if (
      COMMUNICATION_MESSAGES[prediction.label]
    ) {
      setMessage(
        "Experimental prediction ready. Please confirm whether the suggested message is correct."
      );
    } else {
      setMessage(
        "No communication message available for this gesture. Please try again."
      );
    }
  }

  function startRecording() {
    recordingRef.current = {
      startTime: performance.now(),
      frames: [],
    };

    lastSampleRef.current = 0;

    setResult(null);
    setConfirmed(false);
    setRecording(true);

    setMessage(
      "Recording for 3 seconds. Keep both hands visible."
    );
  }

  function confirmMessage() {
    if (
      !result ||
      !COMMUNICATION_MESSAGES[result.label]
    ) {
      return;
    }

    setConfirmed(true);
    setMessage(
      "Message confirmed by the user."
    );
  }

  function tryAgain() {
    recordingRef.current = null;
    setRecording(false);
    setResult(null);
    setConfirmed(false);

    setMessage(
      "Ready to try again. Record another gesture."
    );
  }

  const suggestedMessage = result
    ? COMMUNICATION_MESSAGES[result.label]
    : null;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "30px 20px",
        width: "100%",
        maxWidth: "1000px",
        margin: "0 auto",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          lineHeight: "1.4",
          fontWeight: "700",
          textAlign: "center",
          margin: "0 0 20px 0",
          padding: "10px 0",
          height: "auto",
          whiteSpace: "normal",
        }}
      >
        EchoBridge AI — Experimental ISL Recognition
      </h1>

      <p>
        Reference recordings: {modelInfo.sampleCount}
      </p>

      <GestureRecognition
        onHandLandmarks={handleLandmarks}
      />

      <button
        onClick={startRecording}
        disabled={recording}
        style={{
          padding: "12px 20px",
          marginTop: 15,
          cursor: recording
            ? "not-allowed"
            : "pointer",
        }}
      >
        {recording
          ? "Recording..."
          : "Record and Compare (3 seconds)"}
      </button>

      <p>{message}</p>

      {result && (
        <div
          style={{
            border: "1px solid #888",
            borderRadius: 10,
            padding: 15,
            width: "100%",
            maxWidth: 400,
            margin: "20px auto",
            boxSizing: "border-box",
          }}
        >
          <h2>
            Closest example: {result.label}
          </h2>

          {suggestedMessage ? (
            <div
              style={{
                backgroundColor: confirmed
                  ? "#e8f5e9"
                  : "#fff8e1",
                color: confirmed
                  ? "#1b5e20"
                  : "#795548",
                padding: 15,
                borderRadius: 10,
                marginTop: 12,
              }}
            >
              {confirmed ? (
                <>
                  <h2>
                    Confirmed Communication Message
                  </h2>

                  <h2>{suggestedMessage}</h2>

                  <p>
                    Confirmed by the user.
                  </p>
                </>
              ) : (
                <>
                  <h3>
                    Suggested message
                  </h3>

                  <p>{suggestedMessage}</p>

                  <p>
                    Is this what you intended
                    to communicate?
                  </p>

                  <button
                    onClick={confirmMessage}
                    style={{
                      padding: "10px 15px",
                      margin: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Confirm Message
                  </button>

                  <button
                    onClick={tryAgain}
                    style={{
                      padding: "10px 15px",
                      margin: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#f3f4f6",
                color: "#333",
                padding: 15,
                borderRadius: 10,
                marginTop: 12,
              }}
            >
              <h3>
                Gesture not recognized for communication
              </h3>

              <p>
                {result.label === "UNKNOWN"
                  ? "Unknown gesture."
                  : "Miscellaneous gesture (OTHER)."}
              </p>

              <p>
                No communication message will be displayed.
              </p>

              <button
                onClick={tryAgain}
                style={{
                  padding: "10px 15px",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          <p>
            Landmark distance:{" "}
            {result.distance.toFixed(4)}
          </p>

          {result.secondBestLabel && (
            <div
              style={{
                backgroundColor: "#f3f4f6",
                color: "#333",
                padding: 12,
                borderRadius: 8,
                marginTop: 10,
                textAlign: "left",
              }}
            >
              <p>
                <strong>
                  Second closest gesture:
                </strong>{" "}
                {result.secondBestLabel}
              </p>

              <p>
                <strong>
                  Second closest distance:
                </strong>{" "}
                {result.secondBestDistance.toFixed(4)}
              </p>

              <p>
                <strong>Distance gap:</strong>{" "}
                {result.distanceGap.toFixed(4)}
              </p>
            </div>
          )}

          <p>
            Matched recording: {result.reference}
          </p>

          <p>
            Experimental result only — not verified ISL
            recognition.
          </p>
        </div>
      )}
    </div>
  );
}
