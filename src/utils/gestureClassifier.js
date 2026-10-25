
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function classifyGesture(hand) {
  if (!hand || hand.length !== 21) {
    return "No Hand";
  }

  const wrist = hand[0];

  // Finger tip and middle-joint landmark indices
  const fingers = [
    [8, 6],   // Index finger
    [12, 10], // Middle finger
    [16, 14], // Ring finger
    [20, 18], // Little finger
  ];

  const extended = fingers.map(([tip, joint]) => {
    return (
      distance(hand[tip], wrist) >
      distance(hand[joint], wrist) * 1.1
    );
  });

  const extendedCount =
    extended.filter(Boolean).length;

  // Check thumb extension
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
