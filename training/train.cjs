
const fs = require("node:fs");
const path = require("node:path");

const dataFolder = path.join(
  __dirname,
  "..",
  "src",
  "isl",
  "data"
);

const categories = ["WATER", "OTHER"];

for (const category of categories) {
  const folder = path.join(dataFolder, category);

  if (!fs.existsSync(folder)) {
    console.log(`Missing folder: ${category}`);
    continue;
  }

  const files = fs.readdirSync(folder)
    .filter((name) => name.toLowerCase().endsWith(".json"));

  console.log(`\n${category}: ${files.length} JSON file(s)`);

  for (const filename of files) {
    try {
      const filePath = path.join(folder, filename);
      const data = JSON.parse(
        fs.readFileSync(filePath, "utf8")
      );

      const frames = Array.isArray(data.frames)
        ? data.frames
        : [];

      const bothHands = frames.filter(
        (frame) =>
          frame.hands?.Left?.length === 21 &&
          frame.hands?.Right?.length === 21
      ).length;

      const quality = frames.length
        ? Math.round((bothHands / frames.length) * 100)
        : 0;

      const labelMatches = data.label === category;

      console.log(`  File: ${filename}`);
      console.log(`  Label: ${data.label}`);
      console.log(`  Frames: ${frames.length}`);
      console.log(`  Both hands: ${quality}%`);
      console.log(
        `  Label check: ${labelMatches ? "PASS" : "FAIL"}`
      );
    } catch (error) {
      console.log(`  Error reading ${filename}: ${error.message}`);
    }
  }
}
