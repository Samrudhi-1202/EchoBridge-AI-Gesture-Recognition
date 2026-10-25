
import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const RECORDING_DURATION = 3000;
const SAMPLE_INTERVAL = 100;
const MIN_QUALITY = 90;

export default function ISLRecorder() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const cameraRunningRef = useRef(false);
  const recordingRef = useRef(false);
  const samplesRef = useRef([]);
  const lastSampleRef = useRef(0);
  const recordingStartRef = useRef(0);
  const recordingLabelRef = useRef("UNLABELED_TEST");

  const [status, setStatus] = useState("Loading MediaPipe...");
  const [modelReady, setModelReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [twoHandFrames, setTwoHandFrames] = useState(0);
  const [progress, setProgress] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [selectedLabel, setSelectedLabel] =
    useState("UNLABELED_TEST");

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    async function initialize() {
      try {
        const vision =
          await FilesetResolver.forVisionTasks(WASM_URL);

        if (cancelled) return;

        instance = await HandLandmarker.createFromOptions(
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
          instance.close();
          return;
        }

        landmarkerRef.current = instance;
        setModelReady(true);
        setStatus("MediaPipe ready");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setStatus("MediaPipe loading failed");
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
      cameraRunningRef.current = false;
      recordingRef.current = false;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      instance?.close();
      landmarkerRef.current = null;
    };
  }, []);

  function drawHand(ctx, landmarks, width, height) {
    ctx.strokeStyle = "#00ff66";
    ctx.lineWidth = 3;

    for (const connection of HandLandmarker.HAND_CONNECTIONS) {
      const start = landmarks[connection.start];
      const end = landmarks[connection.end];

      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = "#ff3333";

    landmarks.forEach((point) => {
      ctx.beginPath();
      ctx.arc(
        point.x * width,
        point.y * height,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
  }

  function detect() {
    if (!cameraRunningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (
      video &&
      canvas &&
      landmarker &&
      video.readyState >= 2
    ) {
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);

      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width && height) {
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);

        result.landmarks.forEach((hand) => {
          drawHand(ctx, hand, width, height);
        });
      }

      setHandCount(result.landmarks.length);

      if (recordingRef.current) {
        const elapsed = now - recordingStartRef.current;

        setProgress(
          Math.min(
            100,
            Math.round(
              (elapsed / RECORDING_DURATION) * 100
            )
          )
        );

        if (
          elapsed <= RECORDING_DURATION &&
          now - lastSampleRef.current >= SAMPLE_INTERVAL
        ) {
          const hands = {
            Left: null,
            Right: null,
          };

          result.landmarks.forEach((landmarks, index) => {
            const label =
              result.handednesses?.[index]?.[0]
                ?.categoryName;

            if (label === "Left" || label === "Right") {
              hands[label] = landmarks.map((point) => [
                point.x,
                point.y,
                point.z,
              ]);
            }
          });

          const bothHands =
            hands.Left !== null && hands.Right !== null;

          samplesRef.current.push({
            time: Math.round(elapsed),
            hands,
            bothHands,
          });

          lastSampleRef.current = now;
          setSampleCount(samplesRef.current.length);

          if (bothHands) {
            setTwoHandFrames((count) => count + 1);
          }
        }

        if (elapsed >= RECORDING_DURATION) {
          recordingRef.current = false;
          setRecording(false);
          setProgress(100);
          setStatus("Recording complete");
        }
      }
    }

    if (cameraRunningRef.current) {
      animationRef.current = requestAnimationFrame(detect);
    }
  }

  async function startCamera() {
    if (!landmarkerRef.current || cameraRunningRef.current) {
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

      cameraRunningRef.current = true;
      setCameraOn(true);
      setStatus("Camera running");
      detect();
    } catch (error) {
      console.error(error);

      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      streamRef.current = null;
      setStatus("Camera startup failed");
    }
  }

  function stopCamera() {
    cameraRunningRef.current = false;
    recordingRef.current = false;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    streamRef.current?.getTracks().forEach(
      (track) => track.stop()
    );

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setCameraOn(false);
    setRecording(false);
    setHandCount(0);
    setStatus("Camera stopped");
  }

  function startRecording() {
    if (!cameraRunningRef.current || recordingRef.current) {
      return;
    }

    samplesRef.current = [];
    setSampleCount(0);
    setTwoHandFrames(0);
    setProgress(0);

    const now = performance.now();

    recordingStartRef.current = now;
    lastSampleRef.current = now - SAMPLE_INTERVAL;
    recordingLabelRef.current = selectedLabel;

    recordingRef.current = true;
    setRecording(true);
    setStatus(`Recording ${selectedLabel}...`);
  }

  function downloadSample() {
    if (
      recordingRef.current ||
      samplesRef.current.length === 0
    ) {
      return;
    }

    const frames = samplesRef.current;

    const validFrames = frames.filter(
      (frame) => frame.bothHands
    ).length;

    const quality = Math.round(
      (validFrames / frames.length) * 100
    );

    const label = recordingLabelRef.current;

    if (label === "WATER" && quality < MIN_QUALITY) {
      setStatus(
        `WATER sample rejected: ${quality}% detection. Minimum is ${MIN_QUALITY}%.`
      );
      return;
    }

    const data = {
      label,
      durationMs: RECORDING_DURATION,
      sampleIntervalMs: SAMPLE_INTERVAL,
      bothHandsPercentage: quality,
      capturedAt: new Date().toISOString(),
      frames,
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;

    const nextNumber = savedCount + 1;
    const number = String(nextNumber).padStart(3, "0");

    link.download = `${label}_${number}_${Date.now()}.json`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setSavedCount((count) => count + 1);
    setStatus(`${label} sample downloaded`);
  }

  const quality =
    sampleCount > 0
      ? Math.round(
          (twoHandFrames / sampleCount) * 100
        )
      : 0;

  return (
    <div
      style={{
        textAlign: "center",
        padding: 20,
        maxWidth: 760,
        margin: "auto",
      }}
    >
      <h1>EchoBridge AI — ISL Recorder</h1>
      <p>{status}</p>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          margin: "auto",
          background: "#111",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            display: "block",
            transform: "scaleX(-1)",
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

      <h3>Hands detected: {handCount} / 2</h3>

      <p>
        {handCount === 2
          ? "Both hands detected"
          : handCount === 1
          ? "Only one hand detected"
          : "Show your hands to the camera"}
      </p>

      <div style={{ marginTop: 18 }}>
        <label htmlFor="sign-label">
          <strong>Recording label: </strong>
        </label>

        <select
          id="sign-label"
          value={selectedLabel}
          onChange={(event) =>
            setSelectedLabel(event.target.value)
          }
          disabled={recording}
        >
          <option value="UNLABELED_TEST">
            UNLABELED_TEST
          </option>
          <option value="WATER">WATER</option>
          <option value="OTHER">OTHER</option>
          <option value="THANK_YOU">THANK YOU</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
<option value="FOOD">FOOD</option>
        </select>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: 15,
        }}
      >
        <button
          onClick={startCamera}
          disabled={!modelReady || cameraOn}
        >
          Start Camera
        </button>

        <button
          onClick={stopCamera}
          disabled={!cameraOn}
        >
          Stop Camera
        </button>

        <button
          onClick={startRecording}
          disabled={!cameraOn || recording}
        >
          Record (3 seconds)
        </button>

        <button
          onClick={downloadSample}
          disabled={
            recording ||
            sampleCount === 0 ||
            progress < 100
          }
        >
          Download JSON
        </button>
      </div>

      <h3>Recording Progress: {progress}%</h3>

      <progress
        value={progress}
        max="100"
        style={{ width: "80%" }}
      />

      <p>Recorded frames: {sampleCount}</p>
      <p>Frames with both hands: {twoHandFrames}</p>
      <p>Two-hand detection rate: {quality}%</p>
      <p>Downloaded samples: {savedCount}</p>

      <p style={{ fontSize: 14 }}>
        WATER downloads require at least 90% two-hand
        detection. This measures tracking quality, not
        sign correctness. Only label verified ISL signs.
      </p>
    </div>
  );
}
