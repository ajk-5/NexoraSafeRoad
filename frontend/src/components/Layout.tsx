import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches, useSearchParams } from "react-router";

import emblem from "../assets/nexora-emblem.webp";
import { incidentReference } from "../format";
import { ROLE_LABELS } from "../labels";
import { homePath, workspacePath } from "../paths";
import { useAuth, useOperator } from "../services/auth";
import { LiveDataProvider, useLive } from "../services/live";
import { SettingsProvider } from "../services/settings";
import { AlertAttention } from "./AlertAttention";
import type { Operator } from "../types/api";
import { AccountMenu } from "./header/AccountMenu";
import { AvailabilityControl } from "./header/AvailabilityControl";
import { ConnectionStatus } from "./header/ConnectionStatus";
import { NotificationsMenu } from "./header/NotificationsMenu";
import { Icon, type IconName } from "./Icon";
import { LoadingState } from "./ui";

interface NavItem {
  to: string;
  label: string;
  /** Shown under the icon in the narrow rail. */
  short: string;
  icon: IconName;
}

/** The super admin runs the platform: statistics, accounts and the AI. They never review incidents. */
const SUPERADMIN_NAV: NavItem[] = [
  { to: "/superadmin", label: "Overview", short: "Overview", icon: "chart" },
  { to: "/superadmin/incidents", label: "Incidents", short: "Incidents", icon: "list" },
  { to: "/superadmin/history", label: "History", short: "History", icon: "clock" },
  { to: "/superadmin/map", label: "Map", short: "Map", icon: "map" },
  { to: "/superadmin/training", label: "AI & Training Data", short: "AI & Data", icon: "cpu" },
  { to: "/superadmin/accounts", label: "Accounts", short: "Accounts", icon: "users" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", short: "Dashboard", icon: "dashboard" },
  { to: "/admin/incidents", label: "Incidents", short: "Incidents", icon: "list" },
  { to: "/admin/map", label: "Map", short: "Map", icon: "map" },
  { to: "/admin/history", label: "History", short: "History", icon: "clock" },
];

const OPERATOR_NAV: NavItem[] = [
  { to: "/operator", label: "Dashboard", short: "Dashboard", icon: "dashboard" },
  { to: "/operator/incidents", label: "Incidents", short: "Incidents", icon: "list" },
  { to: "/operator/map", label: "Map", short: "Map", icon: "map" },
];

/** Route `handle` used for the page title in the header and the browser tab. */
export interface RouteHandle {
  title: string;
}

function usePageTitle(): string {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]?.handle as RouteHandle | undefined;
    if (handle?.title) return handle.title;
  }
  return "Nexora SafeRoad";
}

/** The frame of every signed-in page: navigation, header and the shared live data. */
export function Layout() {
  const operator = useOperator();
  return (
    <SettingsProvider key={operator.id} operatorId={operator.id}>
    <LiveDataProvider operator={operator}>
      <Shell operator={operator} />
    </LiveDataProvider>
    </SettingsProvider>
  );
}

function Shell({ operator }: { operator: Operator }) {
  const { pathname } = useLocation();
  const title = usePageTitle();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} · Nexora SafeRoad`;
  }, [title]);
  // Navigating closes the mobile drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className={`app${drawerOpen ? " drawer-open" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar operator={operator} />
      <button type="button" className="drawer-backdrop" aria-label="Close menu" tabIndex={-1} onClick={() => setDrawerOpen(false)} />
      <div className="main-column">
        <Header operator={operator} title={title} onMenu={() => setDrawerOpen(true)} />
        <CurrentWorkBanner operator={operator} />
        <AlertAttention operator={operator} />
        <main id="main" className="content" tabIndex={-1}>
          <Suspense fallback={<LoadingState rows={3} height={120} label="Loading page" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ operator }: { operator: Operator }) {
  const { alerts } = useLive();
  const isServiceOperator = operator.role !== "ADMIN" && operator.role !== "SUPERADMIN";
  const nav = operator.role === "SUPERADMIN" ? SUPERADMIN_NAV : operator.role === "ADMIN" ? ADMIN_NAV : OPERATOR_NAV;
  const area =
    operator.role === "SUPERADMIN" ? "Platform administration" : operator.role === "ADMIN" ? "Operations console" : `${ROLE_LABELS[operator.role]} console`;
  const newAlerts = (alerts.data ?? []).filter((a) => a.status === "SENT").length;

  const link = (item: NavItem, end: boolean) => (
    <li key={item.to}>
      <NavLink
        to={item.to}
        end={end}
        aria-label={item.label}
        className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
      >
        <Icon name={item.icon} />
        <span className="nav-label">{item.label}</span>
        <span className="nav-short" aria-hidden="true">
          {item.short}
        </span>
        {isServiceOperator && item.label === "Dashboard" && newAlerts > 0 && (
          <span className="count-pill nav-count" aria-label={`${newAlerts} new alerts`}>
            {newAlerts}
          </span>
        )}
      </NavLink>
    </li>
  );

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link to={homePath(operator.role)} className="brand" aria-label="SafeRoad, go to the dashboard">
        <img className="brand-mark" src={emblem} alt="" />
        <span className="brand-text">
          <span className="brand-name">SafeRoad</span>
          <span className="brand-area">{area}</span>
        </span>
      </Link>
      <nav>
        <ul className="nav-list">{[...nav, { to: `${homePath(operator.role)}/settings`, label: "Settings", short: "Settings", icon: "settings" as IconName }].map((item, index) => link(item, index === 0))}</ul>
      </nav>
    </aside>
  );
}

function Header({ operator, title, onMenu }: { operator: Operator; title: string; onMenu: () => void }) {
  const { logout, update } = useAuth();
  return (
    <header className="topbar">
      <button type="button" className="btn btn-ghost btn-icon menu-button" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        <ConnectionStatus />
        {/* The super admin is never assigned work: no availability, no work notifications. */}
        {operator.role !== "SUPERADMIN" && (
          <>
            <AvailabilityControl operator={operator} onUpdate={update} />
            <NotificationsMenu operator={operator} />
          </>
        )}
        <AccountMenu operator={operator} onSignOut={logout} />
      </div>
    </header>
  );
}

/** The one thing the operator should do next, on every page except where they are doing it. */
function CurrentWorkBanner({ operator }: { operator: Operator }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const id = operator.currentIncidentId;
  if (id === null) return null;
  const onDashboard = pathname === homePath(operator.role);
  const selected = params.get("incident");
  if (onDashboard && selected === String(id)) return null;
  // On the dashboard with nothing chosen, wide screens already show it in the workspace;
  // phones show the queue first, so they still get the banner.
  const mobileOnly = onDashboard && selected === null;
  const isAdmin = operator.role === "ADMIN";
  return (
    <Link to={workspacePath(operator.role, id)} className={`work-banner${mobileOnly ? " mobile-only" : ""}`}>
      <Icon name={isAdmin ? "alert" : "siren"} />
      <span>
        {isAdmin ? "Incident assigned to you:" : "Your current intervention:"} <strong>{incidentReference(id)}</strong>
      </span>
      <span className="work-banner-action">
        {isAdmin ? "Review now" : "Open"}
        <Icon name="chevronRight" size="sm" />
      </span>
    </Link>
  );
}
