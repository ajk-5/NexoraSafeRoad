import { createBrowserRouter, Navigate } from "react-router";

import { Layout } from "./components/Layout";
import { AdminAlerts } from "./pages/admin/Alerts";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminIncidentDetails } from "./pages/admin/IncidentDetails";
import { AdminIncidents } from "./pages/admin/Incidents";
import { AdminStatistics } from "./pages/admin/Statistics";
import { AdminTraining } from "./pages/admin/Training";
import { AdminTrainingJob } from "./pages/admin/TrainingJob";
import { Login } from "./pages/Login";
import { OperatorAlerts } from "./pages/operator/Alerts";
import { OperatorDashboard } from "./pages/operator/Dashboard";
import { OperatorIncidentDetails } from "./pages/operator/IncidentDetails";
import { OperatorIncidents } from "./pages/operator/Incidents";
import { homePath } from "./paths";
import { useAuth } from "./services/auth";

/** Shows an area only to the roles it is for; everyone else goes to their own home page. */
function RequireArea({ area }: { area: "admin" | "operator" }) {
  const { operator } = useAuth();
  if (operator === null) return <Navigate to="/login" replace />;
  if ((area === "admin") !== (operator.role === "ADMIN")) return <Navigate to={homePath(operator.role)} replace />;
  return <Layout />;
}

function Home() {
  const { operator } = useAuth();
  return <Navigate to={operator ? homePath(operator.role) : "/login"} replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/admin",
    element: <RequireArea area="admin" />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "incidents", element: <AdminIncidents /> },
      { path: "incidents/:id", element: <AdminIncidentDetails /> },
      { path: "alerts", element: <AdminAlerts /> },
      { path: "statistics", element: <AdminStatistics /> },
      { path: "training", element: <AdminTraining /> },
      { path: "training/jobs/:id", element: <AdminTrainingJob /> },
    ],
  },
  {
    path: "/operator",
    element: <RequireArea area="operator" />,
    children: [
      { index: true, element: <OperatorDashboard /> },
      { path: "incidents", element: <OperatorIncidents /> },
      { path: "incidents/:id", element: <OperatorIncidentDetails /> },
      { path: "alerts", element: <OperatorAlerts /> },
    ],
  },
  { path: "*", element: <Home /> },
]);
