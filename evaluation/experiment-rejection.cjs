
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

function loadRecordings(directory, type) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => {
      const data = JSON.parse(
        fs.readFileSync(path.join(directory, filename), "utf8")
      );

      return {
        filename,
        type,
        actual: data.label,
        features: extractFeatures(data.frames),
      };
    });
}

const model = JSON.parse(
  fs.readFileSync(MODEL_PATH, "utf8")
);

const references = model.samples
  .map((sample) => ({
    label: sample.label,
    filename: sample.filename,
    features: extractFeatures(sample.frames),
  }))
  .filter((sample) => sample.features !== null);

const tests = [
  ...loadRecordings(KNOWN_DIR, "KNOWN"),
  ...loadRecordings(UNKNOWN_DIR, "UNKNOWN"),
];

function evaluate(test) {
  if (!test.features) {
    return {
      file: test.filename,
      type: test.type,
      error: "Insufficient frames",
    };
  }

  const matches = references
    .map((reference) => ({
      label: reference.label,
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

  const topThree = matches.slice(0, 3);
  const agreement = topThree.filter(
    (match) => match.label === best.label
  ).length;

  const distance = best.distance;
  const gap = alternative
    ? alternative.distance - distance
    : null;

  // Exploratory rules only; NOT validated thresholds.
  const distanceRule = distance <= 0.25;
  const gapRule = gap !== null && gap >= 0.08;
  const agreementRule = agreement >= 2;

  return {
    file: test.filename,
    type: test.type,
    predicted: best.label,
    distance: Number(distance.toFixed(4)),
    gap: gap === null ? null : Number(gap.toFixed(4)),
    top3Agreement: `${agreement}/3`,
    distanceRule: distanceRule ? "ACCEPT" : "REJECT",
    gapRule: gapRule ? "ACCEPT" : "REJECT",
    agreementRule: agreementRule ? "ACCEPT" : "REJECT",
  };
}

const results = tests.map(evaluate);

console.log("\n=== EXPERIMENTAL REJECTION RESULTS ===");
console.table(results);

console.log("\nTraining references:", references.length);
console.log("Known recordings:", tests.filter(t => t.type === "KNOWN").length);
console.log("Unknown recordings:", tests.filter(t => t.type === "UNKNOWN").length);

console.log(
  "\nWARNING: Thresholds are exploratory and not validated."
);
console.log(
  "Do not apply these rules to live recognition yet."
);
