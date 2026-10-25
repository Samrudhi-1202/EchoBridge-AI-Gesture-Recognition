
# EchoBridge AI - Member 2

## Hand Gesture Recognition Module

Technology:
- React
- JavaScript
- MediaPipe Tasks Vision

## Features
- Webcam-based hand tracking
- Up to two hands
- Open Palm recognition
- Closed Fist recognition
- Thumbs Up recognition
- One-second gesture confirmation
- Callback for confirmed gestures

## Installation

In the main React project:

npm install @mediapipe/tasks-vision

## Integration

Copy GestureRecognition.jsx into:

src/components/GestureRecognition.jsx

Import it:

import GestureRecognition from "./components/GestureRecognition";

Use the component:

<GestureRecognition
  onGestureConfirmed={(data) => {
    console.log(data);
  }}
/>

## Callback Data

The callback provides:

{
  hand: "Right",
  gesture: "Thumbs Up",
  timestamp: 1234567890
}

The hand value is Left or Right.

## Important

This module recognizes three predefined
gestures. It does not recognize complete
Indian Sign Language.

The component requires webcam permission
and access to the MediaPipe model files.
