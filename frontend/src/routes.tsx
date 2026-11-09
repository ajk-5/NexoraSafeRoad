import { lazy } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router";

import { Layout, type RouteHandle } from "./components/Layout";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminHistory } from "./pages/admin/History";
import { AdminIncidents } from "./pages/admin/Incidents";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { OperatorDashboard } from "./pages/operator/Dashboard";
import { OperatorIncidents } from "./pages/operator/Incidents";
import { areaOf, homePath, type Area } from "./paths";
import { useAuth } from "./services/auth";

// Heavier pages (charts, the full map, training) load on first visit.
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const SuperadminOverview = lazy(() => import("./pages/superadmin/Overview").then((m) => ({ default: m.SuperadminOverview })));
const SuperadminAccounts = lazy(() => import("./pages/superadmin/Accounts").then((m) => ({ default: m.SuperadminAccounts })));
const SuperadminIncident = lazy(() => import("./pages/superadmin/IncidentView").then((m) => ({ default: m.SuperadminIncident })));
const SuperadminTraining = lazy(() => import("./pages/superadmin/Training").then((m) => ({ default: m.SuperadminTraining })));
const SuperadminTrainingJob = lazy(() => import("./pages/superadmin/TrainingJob").then((m) => ({ default: m.SuperadminTrainingJob })));

/** Shows an area only to the role it is for; everyone else goes to their own home page. */
function RequireArea({ area }: { area: Area }) {
  const { operator } = useAuth();
  if (operator === null) return <Navigate to="/login" replace />;
  if (areaOf(operator.role) !== area) return <Navigate to={homePath(operator.role)} replace />;
  return <Layout />;
}

function Home() {
  const { operator } = useAuth();
  return <Navigate to={operator ? homePath(operator.role) : "/login"} replace />;
}

/** Old incident pages now open in the dashboard workspace. */
function ToWorkspace({ area }: { area: "admin" | "operator" }) {
  const { id } = useParams();
  return <Navigate to={`/${area}${id ? `?incident=${encodeURIComponent(id)}` : ""}`} replace />;
}

const title = (value: string): RouteHandle => ({ title: value });

export const router = createBrowserRouter([
  { path: "/login", element: <Login />, handle: title("Sign in") },
  {
    // Platform administration: statistics, accounts and the AI. Never reviews incidents.
    path: "/superadmin",
    element: <RequireArea area="superadmin" />,
    children: [
      { index: true, element: <SuperadminOverview />, handle: title("Overview") },
      { path: "settings", element: <Settings />, handle: title("Settings") },
      { path: "incidents", element: <AdminIncidents />, handle: title("Incidents") },
      { path: "incidents/:id", element: <SuperadminIncident />, handle: title("Incident") },
      { path: "history", element: <AdminHistory />, handle: title("History") },
      { path: "map", element: <MapPage />, handle: title("Map") },
      { path: "training", element: <SuperadminTraining />, handle: title("AI & Training Data") },
      { path: "training/jobs/:id", element: <SuperadminTrainingJob />, handle: title("AI & Training Data") },
      { path: "accounts", element: <SuperadminAccounts />, handle: title("Accounts") },
    ],
  },
  {
    path: "/admin",
    element: <RequireArea area="admin" />,
    children: [
      { index: true, element: <AdminDashboard />, handle: title("Dashboard") },
      { path: "settings", element: <Settings />, handle: title("Settings") },
      { path: "incidents", element: <AdminIncidents />, handle: title("Incidents") },
      { path: "incidents/:id", element: <ToWorkspace area="admin" /> },
      { path: "map", element: <MapPage />, handle: title("Map") },
      { path: "history", element: <AdminHistory />, handle: title("History") },
      // Earlier addresses. Statistics, training and accounts now belong to the super admin.
      { path: "alerts", element: <Navigate to="/admin/incidents" replace /> },
      { path: "analytics", element: <Navigate to="/admin" replace /> },
      { path: "statistics", element: <Navigate to="/admin" replace /> },
      { path: "training/*", element: <Navigate to="/admin" replace /> },
      { path: "administration", element: <Navigate to="/admin" replace /> },
    ],
  },
  {
    path: "/operator",
    element: <RequireArea area="operator" />,
    children: [
      { index: true, element: <OperatorDashboard />, handle: title("Dashboard") },
      { path: "settings", element: <Settings />, handle: title("Settings") },
      { path: "incidents", element: <OperatorIncidents />, handle: title("Incidents") },
      { path: "incidents/:id", element: <ToWorkspace area="operator" /> },
      { path: "map", element: <MapPage />, handle: title("Map") },
      { path: "alerts", element: <Navigate to="/operator" replace /> },
    ],
  },
  { path: "*", element: <Home /> },
]);
