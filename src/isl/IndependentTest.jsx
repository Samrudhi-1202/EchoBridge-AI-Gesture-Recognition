
import { useState } from "react";
import { classifyGesture, getModelInfo } from "./gestureClassifier";

export default function IndependentTest() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");

  const modelInfo = getModelInfo();

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError("");
    setFilename(file.name);

    try {
      const data = JSON.parse(await file.text());

      if (!Array.isArray(data.frames)) {
        throw new Error("The JSON file has no valid frames array.");
      }

      const prediction = classifyGesture(data.frames);

      if (!prediction) {
        throw new Error("Not enough usable frames to classify.");
      }

      setResult({
        actual: data.label ?? "Unknown",
        ...prediction,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main style={{ maxWidth: 650, margin: "40px auto", padding: 20 }}>
      <h2
  style={{
    fontSize: "28px",
    lineHeight: 1.4,
    textAlign: "center",
    margin: "20px 0",
  }}
>
  Independent Test
</h2>

      <p>Training samples: {modelInfo.sampleCount}</p>
      <p>Gesture categories: {modelInfo.labels.join(", ")}</p>

      <label htmlFor="test-file">Select a new test recording:</label>
      <input
        id="test-file"
        type="file"
        accept=".json,application/json"
        onChange={handleFile}
        style={{ display: "block", margin: "15px 0" }}
      />

      {filename && <p>File: {filename}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <section style={{ border: "1px solid #888", borderRadius: 12, padding: 20 }}>
          <h2>Recognition Result</h2>
          <p>Actual label: <strong>{result.actual}</strong></p>
          <p>Predicted label: <strong>{result.label}</strong></p>
          <p>
            Result:{" "}
            <strong>
              {result.actual === result.label ? "CORRECT" : "INCORRECT"}
            </strong>
          </p>
          <p>Closest distance: {result.distance.toFixed(4)}</p>
          <p>Matched recording: {result.reference}</p>
          <p>Alternative label: {result.secondBestLabel ?? "None"}</p>
          <p>
            Alternative distance:{" "}
            {result.secondBestDistance?.toFixed(4) ?? "N/A"}
          </p>
          <p>
            Distance gap: {result.distanceGap?.toFixed(4) ?? "N/A"}
          </p>
        </section>
      )}

      <p style={{ fontSize: 13, marginTop: 20 }}>
        Experimental nearest-neighbor recognition. A correct prediction on
        one recording does not establish real-world accuracy.
      </p>
    </main>
  );
}
