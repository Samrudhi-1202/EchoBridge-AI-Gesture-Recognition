
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "src", "isl", "data");
const outputFile = path.join(
  root,
  "src",
  "isl",
  "models",
  "gesture-model.json"
);

const labels = ["WATER", "OTHER", "THANK_YOU", "YES", "NO", "FOOD"];
const samples = [];

for (const label of labels) {
  const folder = path.join(dataDir, label);

  if (!fs.existsSync(folder)) {
    console.log(`Missing folder: ${label}`);
    process.exit(1);
  }

  const files = fs.readdirSync(folder)
    .filter((name) => name.endsWith(".json"));

  for (const filename of files) {
    const recording = JSON.parse(
      fs.readFileSync(path.join(folder, filename), "utf8")
    );

    if (recording.label !== label ||
        !Array.isArray(recording.frames)) {
      console.log(`Skipped invalid recording: ${filename}`);
      continue;
    }

    const validFrames = recording.frames.filter((frame) => {
      const hands = frame.hands;

      return ["Left", "Right"].every((hand) =>
        Array.isArray(hands?.[hand]) &&
        hands[hand].length === 21 &&
        hands[hand].every((point) =>
          Array.isArray(point) &&
          point.length === 3 &&
          point.every(Number.isFinite)
        )
      );
    });

    if (validFrames.length < 5) {
      console.log(`Skipped insufficient recording: ${filename}`);
      continue;
    }

    samples.push({
      label,
      filename,
      frames: validFrames
    });

    console.log(`Exported: ${filename}`);
  }
}

const missingLabels = labels.filter(
  (label) => !samples.some((sample) => sample.label === label)
);

if (missingLabels.length > 0) {
  console.error(
    `Missing valid recordings for: ${missingLabels.join(", ")}`
  );
  process.exit(1);
}
fs.mkdirSync(path.dirname(outputFile), { recursive: true });

fs.writeFileSync(
  outputFile,
  JSON.stringify({
    version: 1,
    type: "experimental-nearest-neighbor",
    labels,
    samples
  }, null, 2)
);

console.log(`\nExport completed: ${samples.length} samples`);
console.log(`Saved to: ${outputFile}`);
