
import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const CONFIRMATION_TIME = 1000;

// Calculate distance between two landmarks
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
// Distance between two wrist landmarks
function wristDistance(a, b) {
  if (!a || !b) return Infinity;

  return Math.hypot(
    a[0] - b[0],
    a[1] - b[1]
  );
}
// Identify gestures
function classifyGesture(hand) {
  if (!hand || hand.length !== 21) {
    return "No Hand";
  }

  const wrist = hand[0];

  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  const extended = fingers.map(([tip, joint]) =>
    distance(hand[tip], wrist) >
    distance(hand[joint], wrist) * 1.1
  );

  const extendedCount = extended.filter(Boolean).length;

  const thumbExtended =
    distance(hand[4], hand[5]) >
    distance(hand[3], hand[5]) * 1.2;

  if (extendedCount === 4 && thumbExtended) {
    return "Open Palm";
  }

  if (extendedCount === 0 && !thumbExtended) {
    return "Closed Fist";
  }

  if (extendedCount === 0 && thumbExtended) {
    return "Thumbs Up";
  }

  return "Unknown Gesture";
}

export default function GestureRecognition({
  onGestureConfirmed,
  onHandLandmarks,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);
  // Remember previous wrist positions for tracking consistency
const previousWristsRef = useRef({
  Left: null,
  Right: null,
});
  // Track gesture stability separately for each hand
  const stabilityRef = useRef({});
  const callbackRef = useRef(onGestureConfirmed);
  const landmarksCallbackRef = useRef(onHandLandmarks);

useEffect(() => {
  landmarksCallbackRef.current = onHandLandmarks;
}, [onHandLandmarks]);
  const [status, setStatus] = useState(
    "Loading MediaPipe..."
  );
  const [handCount, setHandCount] = useState(0);
  const [gestures, setGestures] = useState([]);

  useEffect(() => {
    callbackRef.current = onGestureConfirmed;
  }, [onGestureConfirmed]);

  useEffect(() => {
    let cancelled = false;
    let model;

    async function loadModel() {
      try {
        const vision =
          await FilesetResolver.forVisionTasks(WASM_URL);

        if (cancelled) return;

        model = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          }
        );

        if (cancelled) {
          model.close();
          return;
        }

        modelRef.current = model;
        setStatus("MediaPipe ready");
      } catch (error) {
        if (!cancelled) {
          setStatus("Model error: " + error.message);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
      activeRef.current = false;
      previousWristsRef.current = {
  Left: null,
  Right: null,
};
      cancelAnimationFrame(frameRef.current);

      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      model?.close();
      modelRef.current = null;
    };
  }, []);

  // Check if gesture is stable for one second
  function confirmGesture(handId, gesture, now) {
    if (
      gesture === "Unknown Gesture" ||
      gesture === "No Hand"
    ) {
      delete stabilityRef.current[handId];

      return {
        confirmed: false,
        progress: 0,
      };
    }

    const previous = stabilityRef.current[handId];

    if (!previous || previous.gesture !== gesture) {
      stabilityRef.current[handId] = {
        gesture,
        startTime: now,
        confirmed: false,
      };

      return {
        confirmed: false,
        progress: 0,
      };
    }

    const elapsed = now - previous.startTime;

    const progress = Math.min(
      100,
      (elapsed / CONFIRMATION_TIME) * 100
    );

    if (
      elapsed >= CONFIRMATION_TIME &&
      !previous.confirmed
    ) {
      previous.confirmed = true;

      // Notify the parent component once
      callbackRef.current?.({
        hand: handId,
        gesture,
        timestamp: Date.now(),
      });
    }

    return {
      confirmed: previous.confirmed,
      progress,
    };
  }

  function detectHands() {
    if (!activeRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (
      video &&
      canvas &&
      model &&
      video.readyState >= 2 &&
      video.videoWidth > 0
    ) {
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const now = performance.now();

      const results = model.detectForVideo(video, now);
      const hands = { Left: null, Right: null };

results.landmarks.forEach((landmarks, index) => {
  const handId =
    results.handednesses[index]?.[0]?.categoryName;

  if (handId === "Left" || handId === "Right") {
    hands[handId] = landmarks.map((point) => [
      point.x,
      point.y,
      point.z,
    ]);
  }
});

// Diagnostic: check for possible hand-label switches
for (const handId of ["Left", "Right"]) {
  const currentHand = hands[handId];

  if (!currentHand) continue;

  const currentWrist = currentHand[0];
  const previousSame =
    previousWristsRef.current[handId];

  const oppositeHand =
    handId === "Left" ? "Right" : "Left";

  const previousOpposite =
    previousWristsRef.current[oppositeHand];

  const sameDistance = wristDistance(
    currentWrist,
    previousSame
  );

  const oppositeDistance = wristDistance(
    currentWrist,
    previousOpposite
  );

  // Log only suspicious changes; do not modify labels
  if (
    previousSame &&
    previousOpposite &&
    sameDistance > 0.25 &&
    oppositeDistance < 0.10
  ) {
    console.warn(
      "Possible hand-label switch:",
      handId,
      { sameDistance, oppositeDistance }
    );
  }
}

// Store wrists only when both hands are visible
if (hands.Left && hands.Right) {
  previousWristsRef.current = {
    Left: hands.Left[0],
    Right: hands.Right[0],
  };
}
landmarksCallbackRef.current?.({
  time: now,
  hands,
  bothHands: Boolean(hands.Left && hands.Right),
});
      setHandCount(results.landmarks.length);

      const detectedGestures = [];
      const visibleHands = new Set();

      results.landmarks.forEach((hand, index) => {
        const handId =
          results.handednesses[index]?.[0]
            ?.categoryName ?? `Hand ${index + 1}`;

        visibleHands.add(handId);

        const gesture = classifyGesture(hand);

        const confirmation = confirmGesture(
          handId,
          gesture,
          now
        );

        detectedGestures.push({
          hand: handId,
          gesture,
          confirmed: confirmation.confirmed,
          progress: confirmation.progress,
        });

        // Draw green connections
        ctx.strokeStyle = "#00FF88";
        ctx.lineWidth = 3;

        for (
          const connection of
          HandLandmarker.HAND_CONNECTIONS
        ) {
          const start = hand[connection.start];
          const end = hand[connection.end];

          ctx.beginPath();

          ctx.moveTo(
            start.x * canvas.width,
            start.y * canvas.height
          );

          ctx.lineTo(
            end.x * canvas.width,
            end.y * canvas.height
          );

          ctx.stroke();
        }

        // Draw red landmark points
        for (const point of hand) {
          ctx.beginPath();

          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            5,
            0,
            2 * Math.PI
          );

          ctx.fillStyle = "#FF3333";
          ctx.fill();
        }
      });

      // Reset tracking when a hand disappears
      for (const handId of Object.keys(
        stabilityRef.current
      )) {
        if (!visibleHands.has(handId)) {
          delete stabilityRef.current[handId];
        }
      }

      setGestures(detectedGestures);
    }

    frameRef.current =
      requestAnimationFrame(detectHands);
  }

  async function startCamera() {
    if (!modelRef.current || activeRef.current) {
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      streamRef.current = stream;

      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      activeRef.current = true;
      stabilityRef.current = {};
      previousWristsRef.current = {
  Left: null,
  Right: null,
};
      setStatus("Camera active");

      detectHands();
    } catch (error) {
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      streamRef.current = null;

      setStatus("Camera error: " + error.message);
    }
  }

  function stopCamera() {
    activeRef.current = false;
    previousWristsRef.current = {
      Left: null,
      Right: null,
    };

    cancelAnimationFrame(frameRef.current);

    streamRef.current?.getTracks().forEach(
      (track) => track.stop()
    );

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;

    if (canvas) {
      canvas.getContext("2d").clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    stabilityRef.current = {};

    setHandCount(0);
    setGestures([]);
    setStatus("Camera stopped");
  }

  return (
    <div
      style={{
        textAlign: "center",
        padding: 20,
      }}
    >
      <h1>EchoBridge AI</h1>

      <h2>Hand Gesture Recognition</h2>

      <div
        style={{
          position: "relative",
          maxWidth: 600,
          margin: "auto",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            display: "block",
            transform: "scaleX(-1)",
            borderRadius: 12,
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={startCamera}
          disabled={
            !modelRef.current ||
            (status !== "MediaPipe ready" &&
              status !== "Camera stopped")
          }
        >
          Start Camera
        </button>

        <button
          onClick={stopCamera}
          style={{ marginLeft: 10 }}
        >
          Stop Camera
        </button>
      </div>

      <p>Status: {status}</p>

      <p>Hands detected: {handCount}</p>

      <h2>Gesture Recognition Results</h2>

      {gestures.length === 0 ? (
        <p>No Hand Detected</p>
      ) : (
        gestures.map((item, index) => (
          <div
            key={`${item.hand}-${index}`}
            style={{
              border: "1px solid #888",
              borderRadius: 10,
              padding: 15,
              margin: "10px auto",
              maxWidth: 400,
            }}
          >
            <h3>
              {item.hand}: {item.gesture}
            </h3>

            <p>
              {item.confirmed
                ? "Confirmed"
                : item.gesture === "Unknown Gesture"
                  ? "Waiting for valid gesture"
                  : "Detecting..."}
            </p>

            <progress
              value={item.progress}
              max="100"
              style={{ width: "100%" }}
            />

            <p>
              Confirmation:{" "}
              {Math.round(item.progress)}%
            </p>
          </div>
        ))
      )}
    </div>
  );
}
