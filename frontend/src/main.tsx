import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./routes/AppRoutes";

const rootElement = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </React.StrictMode>,
);
