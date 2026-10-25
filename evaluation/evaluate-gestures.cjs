
const fs = require("fs");
const path = require("path");

const labels = [
  "WATER",
  "OTHER",
  "THANK_YOU",
  "YES",
  "NO",
  "FOOD",
];

const dataDirectory = path.join(
  __dirname,
  "..",
  "src",
  "isl",
  "data"
);

console.log("\nEchoBridge AI — Recording Evaluation\n");

let totalRecordings = 0;

for (const label of labels) {
  const folder = path.join(dataDirectory, label);

  if (!fs.existsSync(folder)) {
    console.log(`${label}: Folder missing`);
    continue;
  }

  const files = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".json"));

  let validRecordings = 0;

  for (const filename of files) {
    const filePath = path.join(folder, filename);

    try {
      const recording = JSON.parse(
        fs.readFileSync(filePath, "utf8")
      );

      const validFrames = (recording.frames || []).filter(
        (frame) =>
          Array.isArray(frame.hands?.Left) &&
          frame.hands.Left.length === 21 &&
          Array.isArray(frame.hands?.Right) &&
          frame.hands.Right.length === 21
      );

      if (validFrames.length >= 5) {
        validRecordings++;
      }
    } catch (error) {
      console.log(`Could not read: ${filename}`);
    }
  }

  totalRecordings += validRecordings;

  console.log(
    `${label}: ${validRecordings} usable recordings`
  );
}

console.log(
  `\nTotal usable recordings: ${totalRecordings}`
);

console.log("\nLeave-One-Out Evaluation\n");

const modelPath = path.join(
  __dirname,
  "..",
  "src",
  "isl",
  "models",
  "gesture-model.json"
);

const model = JSON.parse(
  fs.readFileSync(modelPath, "utf8")
);

const SEQUENCE_LENGTH = 20;
const FEATURES_PER_FRAME = 126;

function normalizeFrame(hands) {
  const features = [];

  for (const hand of ["Left", "Right"]) {
    const points = hands?.[hand];

    if (
      !Array.isArray(points) ||
      points.length !== 21 ||
      !points.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 3 &&
          point.every(Number.isFinite)
      )
    ) {
      return null;
    }

    const wrist = points[0];

    const palmSize =
      Math.hypot(
        points[9][0] - wrist[0],
        points[9][1] - wrist[1]
      ) || 0.001;

    for (const point of points) {
      features.push(
        (point[0] - wrist[0]) / palmSize,
        (point[1] - wrist[1]) / palmSize,
        (point[2] - wrist[2]) / palmSize
      );
    }
  }

  return features;
}

function extractFeatures(frames) {
  if (!Array.isArray(frames)) return null;

  const vectors = frames
    .map((frame) => normalizeFrame(frame.hands))
    .filter(Boolean);

  if (vectors.length < 5) return null;

  const sequence = [];

  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    const position =
      (i * (vectors.length - 1)) /
      (SEQUENCE_LENGTH - 1);

    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const fraction = position - lower;

    for (let j = 0; j < FEATURES_PER_FRAME; j++) {
      sequence.push(
        vectors[lower][j] * (1 - fraction) +
          vectors[upper][j] * fraction
      );
    }
  }

  return sequence;
}

function calculateDistance(a, b) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i];
    sum += difference * difference;
  }

  return Math.sqrt(sum / a.length);
}

const samples = model.samples
  .map((sample) => ({
    label: sample.label,
    filename: sample.filename,
    features: extractFeatures(sample.frames),
  }))
  .filter((sample) => sample.features !== null);

let correct = 0;

for (let i = 0; i < samples.length; i++) {
  const test = samples[i];

  const candidates = samples
    .filter((_, index) => index !== i)
    .map((sample) => ({
  label: sample.label,
  filename: sample.filename,
  distance: calculateDistance(
    test.features,
    sample.features
  ),
}))
    .sort((a, b) => a.distance - b.distance);

  const predicted = candidates[0]?.label ?? "UNKNOWN";
  const isCorrect = predicted === test.label;

  if (isCorrect) correct++;

 console.log(
  `${test.label} → ${predicted} ${
    isCorrect ? "CORRECT" : "INCORRECT"
  }`
);

if (!isCorrect) {
  console.log(`  File: ${test.filename}`);
  const closestCorrect = candidates.find(
  (candidate) => candidate.label === test.label
);

console.log(
  `  Closest correct-label distance: ${
    closestCorrect?.distance.toFixed(4) ?? "N/A"
  }`
);
  console.log(`  Matched with: ${candidates[0]?.filename}`);
  console.log(
  `  Second match: ${candidates[1]?.label} (${candidates[1]?.filename})`
);
console.log(
  `  Second distance: ${candidates[1]?.distance.toFixed(4)}`
);
  console.log(`  Closest distance: ${candidates[0]?.distance.toFixed(4)}`);
} 
}
const accuracy = samples.length
  ? ((correct / samples.length) * 100).toFixed(1)
  : "0.0";

console.log(
  `\nLeave-one-out accuracy: ${correct}/${samples.length} (${accuracy}%)`
);
