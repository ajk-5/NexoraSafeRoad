import "@fontsource-variable/inter";
import "leaflet/dist/leaflet.css";
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { router } from "./routes";
import { AuthProvider } from "./services/auth";
import { applyTheme } from "./services/theme";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

applyTheme(); // before the first paint, so a dark theme never flashes light

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
