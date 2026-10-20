import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import emblem from "../assets/nexora-emblem.webp";
import { incidentReference } from "../format";
import { ROLE_LABELS } from "../labels";
import { api, errorMessage } from "../services/api";
import { useAuth, useOperator } from "../services/auth";
import { usePolling } from "../services/usePolling";
import type { Operator } from "../types/api";
import { OperatorStatusBadge } from "./Badges";

interface NavItem {
  to: string;
  label: string;
}

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/incidents", label: "Incidents" },
  { to: "/admin/alerts", label: "Alerts" },
  { to: "/admin/statistics", label: "Statistics" },
  { to: "/admin/training", label: "AI Training" },
];

const OPERATOR_NAV: NavItem[] = [
  { to: "/operator", label: "Dashboard" },
  { to: "/operator/incidents", label: "Incidents" },
  { to: "/operator/alerts", label: "Alerts" },
];

/** Same sidebar and header on every page of an area (README "Admin/Service Operator Navigation"). */
export function Layout() {
  const operator = useOperator();
  const { pathname } = useLocation();
  const nav = operator.role === "ADMIN" ? ADMIN_NAV : OPERATOR_NAV;
  // Service operators see how many alerts are waiting for someone to accept them,
  // refreshed on every page change too (e.g. right after accepting one).
  const newAlerts = usePolling(
    () => (operator.role === "ADMIN" ? Promise.resolve([]) : api.alerts("SENT")),
    [operator.role, pathname],
  );
  const newAlertCount = newAlerts.data?.length ?? 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={emblem} alt="" />
          <div>
            <div className="brand-name">Nexora SafeRoad</div>
            <div className="brand-area">{ROLE_LABELS[operator.role]}</div>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === nav[0]?.to} className="nav-link">
              {item.label}
              {item.label === "Alerts" && newAlertCount > 0 && <span className="nav-count">{newAlertCount}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <Header operator={operator} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Header({ operator }: { operator: Operator }) {
  const { logout, update } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = operator.status === "PAUSED";

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      update(await (paused ? api.resume() : api.pause()));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const area = operator.role === "ADMIN" ? "/admin" : "/operator";
  const currentId = operator.currentIncidentId;
  const currentPath = currentId === null ? null : `${area}/incidents/${currentId}`;

  return (
    <header className="topbar">
      <div className="topbar-notice">
        {currentId !== null && currentPath !== null && location.pathname !== currentPath && (
          <Link to={currentPath} className="current-banner">
            {operator.role === "ADMIN" ? "Incident assigned to you" : "Your current intervention"}
            <strong>{incidentReference(currentId)}</strong>
            <span>Open →</span>
          </Link>
        )}
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="operator-box">
        <div className="operator-name">{operator.displayName}</div>
        <OperatorStatusBadge status={operator.status} />
        <button type="button" className="button secondary small" onClick={() => void toggle()} disabled={busy}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="button ghost small" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </header>
  );
}
