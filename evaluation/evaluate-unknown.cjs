
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODEL_PATH = path.join(
  ROOT,
  "src",
  "isl",
  "models",
  "gesture-model.json"
);

const KNOWN_DIR = path.join(__dirname, "test-data");
const UNKNOWN_DIR = path.join(__dirname, "unknown-test-data");

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
        (p) =>
          Array.isArray(p) &&
          p.length === 3 &&
          p.every(Number.isFinite)
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
      (i * (vectors.length - 1)) / (SEQUENCE_LENGTH - 1);

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

function loadTests(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => {
      const filepath = path.join(directory, filename);
      const data = JSON.parse(fs.readFileSync(filepath, "utf8"));

      return {
        filename,
        label: data.label,
        features: extractFeatures(data.frames),
      };
    });
}

const model = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));

const references = model.samples
  .map((sample) => ({
    filename: sample.filename,
    label: sample.label,
    features: extractFeatures(sample.frames),
  }))
  .filter((sample) => sample.features !== null);

function evaluate(test) {
  if (!test.features) {
    return {
      filename: test.filename,
      actual: test.label,
      error: "Insufficient valid frames",
    };
  }

  const matches = references
    .map((reference) => ({
      label: reference.label,
      filename: reference.filename,
      distance: calculateDistance(
        test.features,
        reference.features
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = matches[0];
  const alternative = matches.find(
    (match) => match.label !== best.label
  );

  return {
    filename: test.filename,
    actual: test.label,
    predicted: best.label,
    distance: Number(best.distance.toFixed(4)),
    alternative: alternative?.label ?? "None",
    gap: alternative
      ? Number((alternative.distance - best.distance).toFixed(4))
      : null,
  };
}

const knownTests = loadTests(KNOWN_DIR);
const unknownTests = loadTests(UNKNOWN_DIR);

console.log("\n=== KNOWN GESTURE TESTS ===");
console.table(knownTests.map(evaluate));

console.log("\n=== UNKNOWN GESTURE TESTS ===");
console.table(unknownTests.map(evaluate));

console.log("\nTraining references:", references.length);
console.log("Known test files:", knownTests.length);
console.log("Unknown test files:", unknownTests.length);
console.log("\nEvaluation only. No model files were modified.");
