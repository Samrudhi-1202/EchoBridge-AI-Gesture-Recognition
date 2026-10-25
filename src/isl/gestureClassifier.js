
import gestureModel from "./models/gesture-model.json";

const SEQUENCE_LENGTH = 20;
const FEATURES_PER_FRAME = 126;

// Convert recorded hand landmarks into normalized features.
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

export function extractFeatures(frames) {
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

// Prepare reference examples once when the module loads.
const references = gestureModel.samples
  .map((sample) => ({
    label: sample.label,
    filename: sample.filename,
    features: extractFeatures(sample.frames),
  }))
  .filter((sample) => sample.features !== null);

export function classifyGesture(frames) {
  const features = extractFeatures(frames);

  if (!features || references.length === 0) {
    return null;
  }

  const matches = references
    .map((reference) => ({
      label: reference.label,
      filename: reference.filename,
      distance: calculateDistance(
        features,
        reference.features
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const bestMatch = matches[0];

  // Find the nearest example from a different category.
  const alternativeMatch = matches.find(
    (match) => match.label !== bestMatch.label
  );

  const secondBestDistance =
    alternativeMatch?.distance ?? null;

  const distanceGap =
    secondBestDistance === null
      ? null
      : secondBestDistance - bestMatch.distance;

  return {
    label: bestMatch.label,
    distance: bestMatch.distance,
    reference: bestMatch.filename,

    // Diagnostic values for future rejection testing.
    secondBestLabel: alternativeMatch?.label ?? null,
    secondBestDistance,
    distanceGap,
  };
}

export function getModelInfo() {
  return {
    labels: gestureModel.labels,
    sampleCount: references.length,
  };
}
