import React from "react";
import ReactDOM from "react-dom/client";
import { LyricOverlayApp } from "./LyricOverlayApp";
import "./lyric-overlay.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LyricOverlayApp />
  </React.StrictMode>,
);
