
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "src", "isl", "data");
const LABELS = ["WATER", "OTHER"];
const SEQUENCE_LENGTH = 20;
const POINTS_PER_HAND = 21;
const FEATURES_PER_FRAME = POINTS_PER_HAND * 2 * 3;

function loadRecording(filePath, expectedLabel) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (data.label !== expectedLabel || !Array.isArray(data.frames)) {
    throw new Error("Incorrect label or missing frames");
  }

  const frames = data.frames
    .filter((frame) => {
      const hands = frame.hands;
      return (
        Array.isArray(hands?.Left) &&
        Array.isArray(hands?.Right) &&
        hands.Left.length === 21 &&
        hands.Right.length === 21 &&
        [...hands.Left, ...hands.Right].every(
          (point) =>
            Array.isArray(point) &&
            point.length === 3 &&
            point.every(Number.isFinite)
        )
      );
    })
    .sort((a, b) => a.time - b.time);

  if (frames.length < 5) {
    throw new Error("Not enough valid two-hand frames");
  }

  // Normalize positions relative to each hand's wrist.
  // This reduces dependence on where hands appear in the camera.
  const vectors = frames.map((frame) => {
    const features = [];

    for (const hand of ["Left", "Right"]) {
      const points = frame.hands[hand];
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
  });

  // Resample every recording to the same sequence length.
  const sequence = [];

  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    const position =
      (i * (vectors.length - 1)) / (SEQUENCE_LENGTH - 1);

    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const fraction = position - lower;

    for (let j = 0; j < FEATURES_PER_FRAME; j++) {
      const value =
        vectors[lower][j] * (1 - fraction) +
        vectors[upper][j] * fraction;

      sequence.push(value);
    }
  }

  return {
    label: expectedLabel,
    filename: path.basename(filePath),
    sequence,
  };
}

function distance(a, b) {
  let total = 0;

  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i];
    total += difference * difference;
  }

  return Math.sqrt(total / a.length);
}

const samples = [];

for (const label of LABELS) {
  const folder = path.join(DATA_DIR, label);

  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.log(`Missing folder: ${label}`);
    continue;
  }

  const filenames = fs.readdirSync(folder)
    .filter((name) => name.toLowerCase().endsWith(".json"));

  for (const filename of filenames) {
    try {
      const sample = loadRecording(
        path.join(folder, filename),
        label
      );

      samples.push(sample);
      console.log(`Loaded: ${filename} (${label})`);
    } catch (error) {
      console.log(`Skipped: ${filename} - ${error.message}`);
    }
  }
}

console.log(`\nTotal usable recordings: ${samples.length}`);

if (!LABELS.every((label) => samples.some((s) => s.label === label))) {
  console.log("Need usable recordings from both categories.");
  process.exit(1);
}

console.log("\nLeave-one-out comparison (experimental):");

for (let i = 0; i < samples.length; i++) {
  const test = samples[i];

  const candidates = samples.filter((_, index) => index !== i);

  if (!LABELS.every((label) =>
    candidates.some((sample) => sample.label === label)
  )) {
    console.log(
      `${test.filename}: skipped (not enough other examples)`
    );
    continue;
  }

  const nearest = candidates
    .map((sample) => ({
      label: sample.label,
      distance: distance(test.sequence, sample.sequence),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  console.log(
    `${test.filename}: actual=${test.label}, ` +
    `predicted=${nearest.label}, ` +
    `distance=${nearest.distance.toFixed(4)}`
  );
}

console.log(
  "\nNote: This is a tiny-data experiment, not a validated ISL model."
);
