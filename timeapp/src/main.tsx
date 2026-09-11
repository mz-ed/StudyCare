import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerProvider } from "./lib/timer";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TimerProvider>
      <App />
    </TimerProvider>
  </React.StrictMode>,
);
