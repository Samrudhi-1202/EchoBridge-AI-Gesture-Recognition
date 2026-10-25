
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ISLRecorder from "./isl/ISLRecorder.jsx";
import LiveISLRecognition from "./isl/LiveISLRecognition.jsx";
import "./index.css";

const path = window.location.pathname;

const CurrentPage =
  path === "/isl-recorder"
    ? ISLRecorder
    : path === "/isl-live"
      ? LiveISLRecognition
      : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CurrentPage />
  </React.StrictMode>
);
