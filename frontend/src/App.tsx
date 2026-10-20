import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileVideo2,
  Flame,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Shield,
  Siren,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ApiError, api } from "./api";
import {
  apiMediaUrl,
  displayDate,
  ROLE_LABEL,
  roleHome,
  ROLES,
  STATUS_LABEL,
  type Incident,
  type Operator,
  type Role,
  type Service,
  type Session,
} from "./domain";

interface AuthValue {
  session: Session | null;
  setSession: (value: Session | null) => void;
  updateOperator: (operator: Operator) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const SERVICE_OPTIONS: Service[] = ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"];

function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthContext is missing");
  return value;
}

function storedSession(): Session | null {
  try {
    const value = sessionStorage.getItem("nexora-session");
    return value ? JSON.parse(value) as Session : null;
  } catch {
    sessionStorage.removeItem("nexora-session");
    return null;
  }
}

export default function App() {
  const [session, setSessionState] = useState<Session | null>(storedSession);
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem("nexora-session")));

  const setSession = useCallback((value: Session | null) => {
    setSessionState(value);
    if (value) sessionStorage.setItem("nexora-session", JSON.stringify(value));
    else sessionStorage.removeItem("nexora-session");
  }, []);

  const updateOperator = useCallback((operator: Operator) => {
    setSessionState((current) => {
      if (!current) return current;
      const updated = { ...current, operator };
      sessionStorage.setItem("nexora-session", JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    const cached = storedSession();
    if (!cached) {
      setChecking(false);
      return;
    }
    let active = true;
    api.me(cached.token).then((operator) => {
      if (active) {
        const next = { ...cached, operator };
        setSessionState(next);
        sessionStorage.setItem("nexora-session", JSON.stringify(next));
      }
    }).catch(() => {
      if (active) {
        sessionStorage.removeItem("nexora-session");
        setSessionState(null);
      }
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ session, setSession, updateOperator }), [session, setSession, updateOperator]);
  if (checking) return <LoadingScreen label="Restoring secure session" />;

  return (
    <AuthContext.Provider value={value}>
      <Routes>
        <Route path="/login" element={session ? <Navigate to={roleHome(session.operator.role)} replace /> : <LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<RoleGate role="ADMIN"><AppShell /></RoleGate>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="incidents" element={<AdminIncidents />} />
            <Route path="incidents/:id" element={<AdminIncidentDetail />} />
            <Route path="alerts" element={<AdminAlerts />} />
            <Route path="statistics" element={<StatisticsPage />} />
          </Route>
          <Route path="/operator" element={<RoleGate service><AppShell /></RoleGate>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<OperatorDashboard />} />
            <Route path="incidents" element={<OperatorIncidents />} />
            <Route path="incidents/:id" element={<OperatorIncidentDetail />} />
            <Route path="alerts" element={<OperatorAlerts />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to={session ? roleHome(session.operator.role) : "/login"} replace />} />
        <Route path="*" element={<Navigate to={session ? roleHome(session.operator.role) : "/login"} replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("ADMIN");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await api.login(role, username.trim(), password);
      setSession(result);
      navigate(roleHome(result.operator.role), { replace: true });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-showcase">
        <div className="brand brand-light"><span className="brand-mark"><Siren size={21} /></span><span>NEXORA<span className="brand-light-sub"> SAFEROAD</span></span></div>
        <div className="showcase-copy">
          <span className="eyebrow light-eyebrow"><span className="live-dot" /> INCIDENT COORDINATION PLATFORM</span>
          <h1>One clear view.<br /><span>Faster response.</span></h1>
          <p>Human-led incident management for safer roads. Review what matters, coordinate the right teams, and keep every response moving.</p>
        </div>
        <div className="showcase-status">
          <div className="showcase-status-icon"><Activity size={18} /></div>
          <div><strong>Operations console</strong><span>Secure operator access</span></div>
          <span className="status-online"><i /> READY</span>
        </div>
        <div className="showcase-orbit orbit-one" />
        <div className="showcase-orbit orbit-two" />
      </section>
      <section className="login-panel">
        <div className="login-top-mobile"><div className="brand"><span className="brand-mark"><Siren size={20} /></span>NEXORA SAFEROAD</div></div>
        <div className="login-card">
          <div className="login-kicker">OPERATOR ACCESS</div>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your operations workspace.</p>
          {error && <InlineError message={error} />}
          <form onSubmit={submit} className="login-form">
            <label htmlFor="role">Sign in as</label>
            <div className="select-wrap">
              <Shield className="input-icon" size={17} />
              <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((option) => <option key={option} value={option}>{ROLE_LABEL[option]}</option>)}
              </select>
              <ChevronDown className="select-chevron" size={16} />
            </div>
            <label htmlFor="username">Username</label>
            <input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. admin1" />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            <button className="button button-primary button-wide login-submit" disabled={submitting}>
              {submitting ? <><Spinner /> Signing in…</> : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
          <div className="demo-note"><span className="demo-note-icon"><Radio size={16} /></span><span><strong>Demo environment</strong><br />Use a seeded account from the project README.<br /><span className="demo-password">Default demo password: <code>saferoad</code></span></span></div>
        </div>
        <div className="login-foot">NEXORA SAFEROAD <span>•</span> AUTHORIZED OPERATORS ONLY</div>
      </section>
    </main>
  );
}

function RequireAuth() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

function RoleGate({ role, service, children }: { role?: Role; service?: boolean; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  const valid = role ? session.operator.role === role : service ? session.operator.role !== "ADMIN" : true;
  return valid ? children : <Navigate to={roleHome(session.operator.role)} replace />;
}

function AppShell() {
  const { session, setSession, updateOperator } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState("");
  const navigate = useNavigate();
  const isAdmin = session?.operator.role === "ADMIN";
  const token = session?.token || "";

  useEffect(() => {
    if (!token) return;
    const beat = async () => {
      try {
        updateOperator(await api.heartbeat(token));
        setHeartbeatError("");
      } catch (error) {
        setHeartbeatError(messageOf(error));
      }
    };
    const timer = window.setInterval(() => { void beat(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [token, updateOperator]);

  async function toggleAvailability() {
    if (!session) return;
    setHeartbeatError("");
    try {
      updateOperator(await api.setPaused(token, session.operator.status !== "PAUSED"));
    } catch (error) {
      setHeartbeatError(messageOf(error));
    }
  }

  async function signOut() {
    try {
      await api.logout(token);
    } catch {
      // Clear the local session even if the API is unreachable.
    } finally {
      setSession(null);
      navigate("/login", { replace: true });
    }
  }

  if (!session) return <Navigate to="/login" replace />;
  const operator = session.operator;
  const roleBase = isAdmin ? "/admin" : "/operator";
  const navItems = isAdmin
    ? [
      { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/admin/incidents", label: "Incidents", icon: AlertTriangle },
      { to: "/admin/alerts", label: "Alert history", icon: Bell },
      { to: "/admin/statistics", label: "Statistics", icon: Activity },
    ]
    : [
      { to: "/operator/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/operator/incidents", label: "My incidents", icon: AlertTriangle },
      { to: "/operator/alerts", label: "Incoming alerts", icon: Bell },
    ];

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <Link to={roleBase} className="brand sidebar-brand"><span className="brand-mark"><Siren size={20} /></span><span>NEXORA<span className="brand-sub"> SAFEROAD</span></span></Link>
        <div className="workspace-label">OPERATIONS</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`} onClick={() => setMenuOpen(false)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Incoming alerts" && <span className="nav-arrow"><ArrowRight size={14} /></span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><span className="connection-symbol"><Radio size={16} /></span><span><strong>API connection</strong><small>Live incident data</small></span><i className="connection-dot" /></div>
          <div className="sidebar-user">
            <Avatar name={operator.displayName} />
            <div className="sidebar-user-info"><strong>{operator.displayName}</strong><span>{ROLE_LABEL[operator.role]}</span></div>
            <button className="icon-button logout-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-sep">/</span><strong>{ROLE_LABEL[operator.role]}</strong></div>
          <div className="topbar-right">
            <div className="system-live"><span className="live-dot" /> SYSTEM LIVE</div>
            <span className={`status-pill status-${operator.status.toLowerCase()}`}><i /> {STATUS_LABEL[operator.status]}</span>
            <button className={`button button-small ${operator.status === "PAUSED" ? "button-success" : "button-quiet"}`} onClick={() => void toggleAvailability()} disabled={operator.status === "OFFLINE"} title={operator.status === "PAUSED" ? "Resume availability" : "Pause new assignments"}>
              {operator.status === "PAUSED" ? <Play size={14} /> : <Pause size={14} />}{operator.status === "PAUSED" ? "Resume" : "Pause"}
            </button>
          </div>
        </header>
        {heartbeatError && <div className="heartbeat-banner"><InlineError message={`Heartbeat issue: ${heartbeatError}`} /></div>}
        <main className="page-content"><Outlet /></main>
        <footer className="app-footer"><span>NEXORA SAFEROAD</span><span>Human-led response coordination</span></footer>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { session } = useAuth();
  const load = useCallback(async () => {
    const token = session!.token;
    const [incidents, alerts, operators, stats] = await Promise.all([
      api.incidents(token), api.alerts(token), api.operators(token), api.statistics(token),
    ]);
    return { incidents, alerts, operators, stats };
  }, [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading operations overview" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load the dashboard."} retry={resource.refresh} />;
  const { incidents, alerts, operators, stats } = resource.data;
  const active = incidents.filter((item) => !["RESOLVED", "DECLINED"].includes(item.status));
  const review = incidents.filter((item) => item.status === "ASSIGNED" || item.status === "UNDER_REVIEW");
  return (
    <>
      <PageHeading eyebrow="CONTROL ROOM" title="Operations overview" description="A live view of detected incidents and response activity." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      <div className="stats-grid">
        <Metric label="Active incidents" value={active.length} icon={AlertTriangle} accent="orange" trend={review.length ? `${review.length} need review` : "No reviews pending"} />
        <Metric label="Alerts in progress" value={alerts.filter((a) => a.status !== "RESOLVED").length} icon={Bell} accent="blue" trend={`${alerts.length} total alerts`} />
        <Metric label="Resolved incidents" value={stats.resolvedIncidents} icon={CheckCircle2} accent="green" trend={`${stats.totalIncidents} incidents total`} />
        <Metric label="Operators available" value={operators.filter((item) => item.status === "ACTIVE").length} icon={Users} accent="purple" trend={`${operators.length} operators registered`} />
      </div>
      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">LIVE ACTIVITY</span><h2>Incident locations</h2></div><Link className="text-link" to="/admin/incidents">All incidents <ArrowRight size={15} /></Link></div>
        <IncidentLocationPanel incidents={active.slice(0, 5)} />
      </section>
      <div className="dashboard-columns">
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">REQUIRES ATTENTION</span><h2>Review queue</h2></div><span className="count-bubble">{review.length}</span></div>
          {review.length ? <IncidentList incidents={review.slice(0, 4)} base="/admin/incidents" /> : <EmptyState icon={CheckCircle2} title="You're all caught up" text="New incidents assigned to you will appear here." />}
        </section>
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">RESPONSE TEAMS</span><h2>Operator availability</h2></div><Link className="text-link" to="/admin/statistics">Details <ArrowRight size={14} /></Link></div>
          <OperatorRoster operators={operators.slice(0, 6)} />
        </section>
      </div>
      <section className="card recent-alerts-card">
        <div className="card-heading"><div><span className="section-kicker">LATEST DISPATCHES</span><h2>Recent alerts</h2></div><Link className="text-link" to="/admin/alerts">View history <ArrowRight size={14} /></Link></div>
        {alerts.length ? <AlertRows alerts={alerts.slice(0, 4)} /> : <EmptyState icon={Bell} title="No alerts yet" text="Alerts sent by the control room will show here." />}
      </section>
    </>
  );
}

function AdminIncidents() {
  const { session } = useAuth();
  const load = useCallback(() => api.incidents(session!.token), [session]);
  const resource = useResource(load);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  if (resource.loading) return <LoadingScreen label="Loading incidents" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load incidents."} retry={resource.refresh} />;
  const allIncidents = resource.data;
  const incidents = allIncidents.filter((item) => filter === "ALL" || (filter === "OPEN" ? !["RESOLVED", "DECLINED"].includes(item.status) : item.status === "RESOLVED"));
  return (
    <>
      <PageHeading eyebrow="INCIDENT MANAGEMENT" title="Incidents" description="Review detected events, current decisions, and response progress." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      <div className="filter-bar"><div className="filter-tabs">{(["ALL", "OPEN", "RESOLVED"] as const).map((item) => <button key={item} className={`filter-tab ${filter === item ? "filter-tab-active" : ""}`} onClick={() => setFilter(item)}>{item === "ALL" ? "All incidents" : item === "OPEN" ? "Active" : "Resolved"}<span>{item === "ALL" ? allIncidents.length : item === "OPEN" ? allIncidents.filter((x) => !["RESOLVED", "DECLINED"].includes(x.status)).length : allIncidents.filter((x) => x.status === "RESOLVED").length}</span></button>)}</div><span className="muted table-side-note">Latest incidents first</span></div>
      {incidents.length ? <IncidentTable incidents={incidents} /> : <EmptyState icon={AlertTriangle} title="No incidents in this view" text="Incidents reported by the detection pipeline will appear here." />}
    </>
  );
}

function AdminIncidentDetail() {
  const { session, updateOperator } = useAuth();
  const { id } = useParams();
  const incidentId = Number(id);
  const [selected, setSelected] = useState<Service[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    let incident = await api.incident(session!.token, incidentId);
    if (incident.canEdit && incident.status === "ASSIGNED") {
      incident = await api.reviewIncident(session!.token, incidentId);
    }
    return incident;
  }, [session, incidentId]);
  const resource = useResource(load);
  const initializedFor = useRef<number | null>(null);
  useEffect(() => {
    if (resource.data && initializedFor.current !== resource.data.id) {
      initializedFor.current = resource.data.id;
      setSelected(resource.data.selectedServices.length ? resource.data.selectedServices : resource.data.suggestedServices.map((item) => item.service));
    }
  }, [resource.data]);

  async function perform(action: "draft" | "send" | "decline") {
    if (!resource.data) return;
    if (action === "send" && selected.length === 0) return;
    if (action === "decline" && !window.confirm(`Decline ${resource.data.reference}? This decision will close the review.`)) return;
    setSaving(true);
    setActionError("");
    setNotice("");
    let actionSucceeded = false;
    try {
      if (action === "draft") {
        await api.saveDraft(session!.token, incidentId, selected);
        setNotice("Draft saved. You can return to this incident later.");
      } else if (action === "send") {
        await api.sendAlert(session!.token, incidentId, selected);
        setNotice("Alerts sent to the selected services.");
      } else {
        await api.declineIncident(session!.token, incidentId);
        setNotice("Incident declined.");
      }
      actionSucceeded = true;
      try {
        updateOperator(await api.me(session!.token));
      } catch (error) {
        setActionError(`Decision saved, but operator status could not be refreshed: ${messageOf(error)}`);
      }
      await resource.refresh();
    } catch (error) {
      if (!actionSucceeded) setActionError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  if (!Number.isInteger(incidentId) || incidentId < 1) return <ErrorState message="Invalid incident reference." />;
  if (resource.loading) return <LoadingScreen label="Opening incident review" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Incident not found."} retry={resource.refresh} />;
  const incident = resource.data;
  return (
    <>
      <div className="back-row"><Link to="/admin/incidents" className="back-link"><ArrowLeft size={16} /> Back to incidents</Link><span className="breadcrumb-sep">/</span><span>{incident.reference}</span></div>
      <PageHeading eyebrow="INCIDENT REVIEW" title={incident.reference} description={incident.location || "Location not provided"} action={<StatusBadge value={incident.status} />} />
      {notice && <div className="notice-banner"><CheckCircle2 size={17} />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {actionError && <InlineError message={actionError} />}
      {!incident.canEdit && <div className="readonly-banner"><Shield size={17} /><span><strong>Read-only incident</strong> — {incident.assignedAdmin ? `Currently assigned to ${incident.assignedAdmin}.` : "This incident is no longer available for review."} You can monitor its status and response.</span></div>}
      <div className="detail-grid">
        <section className="card video-card">
          <div className="card-heading"><div><span className="section-kicker">INCIDENT EVIDENCE</span><h2>Camera footage</h2></div><span className="subtle-chip"><Radio size={13} /> {incident.cameraId}</span></div>
          {incident.videoUrl ? <video className="incident-video" controls preload="metadata" src={apiMediaUrl(incident.videoUrl)}>Your browser does not support video playback.</video> : <div className="video-placeholder"><div className="video-placeholder-icon"><FileVideo2 size={26} /></div><strong>Video not available</strong><span>No clip has been attached to this incident.</span></div>}
          <LocationBlock location={incident.location} latitude={incident.latitude} longitude={incident.longitude} />
        </section>
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">INCIDENT SUMMARY</span><h2>Key information</h2></div><SeverityBadge value={incident.severity} /></div>
          <div className="info-grid">
            <InfoItem label="Detected" value={displayDate(incident.detectedAt)} icon={Clock3} />
            <InfoItem label="AI confidence" value={`${Math.round(incident.confidence * 100)}%`} icon={Activity} />
            <InfoItem label="Vehicles involved" value={String(incident.vehicles)} icon={Truck} />
            <InfoItem label="People detected" value={String(incident.people)} icon={Users} />
          </div>
          <div className="incident-flags">
            <span className={incident.possibleInjuries ? "flag-warning" : "flag-calm"}><i /> Possible injuries {incident.possibleInjuries ? "reported" : "not reported"}</span>
            {incident.fire && <span className="flag-warning"><Flame size={14} /> Fire detected</span>}
            {incident.overturned && <span className="flag-warning"><AlertTriangle size={14} /> Overturned vehicle</span>}
          </div>
          <div className="assigned-line"><span>Review owner</span><strong>{incident.assignedAdmin || "Not assigned"}</strong></div>
        </section>
      </div>
      <section className="card response-card">
        <div className="card-heading"><div><span className="section-kicker">AI-ASSISTED · HUMAN DECISION</span><h2>Recommended response</h2><p className="muted">Review recommendations and choose which services to alert.</p></div><span className="ai-chip"><Activity size={13} /> AI SUGGESTION</span></div>
        <div className="service-options">
          {SERVICE_OPTIONS.map((service) => {
            const suggestion = incident.suggestedServices.find((item) => item.service === service);
            const checked = selected.includes(service);
            return (
              <label key={service} className={`service-option ${checked ? "service-option-selected" : ""} ${!incident.canEdit ? "service-option-disabled" : ""}`}>
                <input type="checkbox" checked={checked} disabled={!incident.canEdit} onChange={() => setSelected((current) => checked ? current.filter((item) => item !== service) : [...current, service])} />
                <span className="custom-check">{checked && <Check size={13} />}</span>
                <span className="service-option-icon">{serviceIcon(service)}</span>
                <span className="service-option-copy"><strong>{ROLE_LABEL[service]}</strong><small>{suggestion ? suggestion.reason : "Not recommended by the AI"}</small></span>
                {suggestion && <span className="suggested-label">SUGGESTED</span>}
              </label>
            );
          })}
        </div>
        <div className="response-actions">
          <div className="readonly-hint">{incident.canEdit ? "Final dispatch decision remains with the operator." : "Only the assigned operator can make changes."}</div>
          <div className="button-row">
            <button className="button button-danger-quiet" disabled={!incident.canEdit || saving} onClick={() => void perform("decline")}>Decline</button>
            <button className="button button-secondary" disabled={!incident.canEdit || saving} onClick={() => void perform("draft")}>{saving ? <Spinner /> : null} Save draft</button>
            <button className="button button-primary" disabled={!incident.canEdit || !selected.length || saving} onClick={() => void perform("send")}>{saving ? <Spinner /> : <Bell size={16} />} Send alerts <ArrowRight size={15} /></button>
          </div>
        </div>
      </section>
      {incident.alerts.length > 0 && <section className="card"><div className="card-heading"><div><span className="section-kicker">DISPATCH STATUS</span><h2>Service responses</h2></div></div><AlertRows alerts={incident.alerts.map((a) => ({ ...a, incidentId: incident.id, incidentReference: incident.reference, severity: incident.severity, location: incident.location, latitude: incident.latitude, longitude: incident.longitude, vehicles: incident.vehicles, possibleInjuries: incident.possibleInjuries, canAccept: false, canUpdate: false }))} /></section>}
    </>
  );
}

function AdminAlerts() {
  const { session } = useAuth();
  const load = useCallback(() => api.alerts(session!.token), [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading alert history" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load alerts."} retry={resource.refresh} />;
  return (
    <>
      <PageHeading eyebrow="DISPATCH HISTORY" title="Alerts" description="Monitor service notifications and their intervention status." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      <div className="stats-grid compact-stats">
        <Metric label="Total dispatched" value={resource.data.length} icon={Bell} accent="blue" />
        <Metric label="Awaiting acceptance" value={resource.data.filter((item) => item.status === "SENT").length} icon={Clock3} accent="orange" />
        <Metric label="Active response" value={resource.data.filter((item) => !["SENT", "RESOLVED"].includes(item.status)).length} icon={Radio} accent="purple" />
        <Metric label="Resolved" value={resource.data.filter((item) => item.status === "RESOLVED").length} icon={CheckCircle2} accent="green" />
      </div>
      {resource.data.length ? <div className="card"><AlertRows alerts={resource.data} detailed /></div> : <EmptyState icon={Bell} title="No alerts have been sent" text="Service alerts will be listed here after an incident is reviewed." />}
    </>
  );
}

function StatisticsPage() {
  const { session } = useAuth();
  const load = useCallback(() => api.statistics(session!.token), [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading statistics" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load statistics."} retry={resource.refresh} />;
  const stats = resource.data;
  const dayMax = Math.max(1, ...stats.incidentsPerDay.map((item) => item.count));
  const severityTotal = Math.max(1, ...Object.values(stats.incidentsBySeverity), 0);
  const operatorsTotal = Object.values(stats.operatorsByStatus).reduce((sum, count) => sum + (count || 0), 0);
  return (
    <>
      <PageHeading eyebrow="OPERATIONAL INTELLIGENCE" title="Statistics" description="Incident volume, severity, dispatch activity, and operator availability." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      <div className="stats-grid">
        <Metric label="Total incidents" value={stats.totalIncidents} icon={AlertTriangle} accent="orange" />
        <Metric label="Resolved" value={stats.resolvedIncidents} icon={CheckCircle2} accent="green" trend={stats.totalIncidents ? `${Math.round(stats.resolvedIncidents / stats.totalIncidents * 100)}% of total` : "No incidents yet"} />
        <Metric label="Avg. response time" value={stats.averageResponseSeconds == null ? "—" : formatDuration(stats.averageResponseSeconds)} icon={Clock3} accent="blue" trend="Alert sent to accepted" />
        <Metric label="Operators" value={operatorsTotal} icon={Users} accent="purple" trend="All service teams" />
      </div>
      <div className="dashboard-columns">
        <section className="card chart-card">
          <div className="card-heading"><div><span className="section-kicker">INCIDENT TRENDS</span><h2>Incidents per day</h2></div><span className="subtle-chip"><Activity size={13} /> Recent activity</span></div>
          {stats.incidentsPerDay.length ? <div className="bar-chart" role="img" aria-label="Incidents reported per day">{stats.incidentsPerDay.map((item) => <div className="bar-column" key={item.date}><span className="bar-value">{item.count}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.count ? 9 : 3, item.count / dayMax * 100)}%` }} /></div><span className="bar-label">{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span></div>)}</div> : <EmptyState icon={Activity} title="No trend data yet" text="The daily incident chart will populate as incidents arrive." />}
        </section>
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">RISK PROFILE</span><h2>By severity</h2></div></div>
          {(["HIGH", "MEDIUM", "LOW"] as const).map((severity) => {
            const count = stats.incidentsBySeverity[severity] || 0;
            return <div className="severity-meter" key={severity}><div><SeverityBadge value={severity} /><strong>{count}</strong></div><div className="meter-track"><span className={`meter-fill meter-${severity.toLowerCase()}`} style={{ width: `${count / severityTotal * 100}%` }} /></div></div>;
          })}
          <div className="stats-divider" />
          <div className="card-heading small-card-heading"><div><span className="section-kicker">BY SERVICE</span><h2>Alerts dispatched</h2></div></div>
          {SERVICE_OPTIONS.map((service) => <div className="service-stat-row" key={service}><span>{serviceIcon(service)}{ROLE_LABEL[service]}</span><strong>{stats.alertsByService[service] || 0}</strong></div>)}
        </section>
      </div>
      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">TEAM STATUS</span><h2>Operator availability</h2></div></div>
        <div className="availability-grid">{(["ACTIVE", "BUSY", "PAUSED", "OFFLINE"] as const).map((status) => <div className="availability-item" key={status}><StatusBadge value={status} /><strong>{stats.operatorsByStatus[status] || 0}</strong><span>operators</span></div>)}</div>
      </section>
    </>
  );
}

function OperatorDashboard() {
  const { session } = useAuth();
  const load = useCallback(() => api.alerts(session!.token), [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading your response dashboard" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load alerts."} retry={resource.refresh} />;
  const alerts = resource.data;
  const active = alerts.filter((item) => item.status !== "RESOLVED");
  const needsAcceptance = alerts.filter((item) => item.canAccept);
  return (
    <>
      <PageHeading eyebrow={`${ROLE_LABEL[session!.operator.role].toUpperCase()} RESPONSE TEAM`} title={`Good ${greeting()}, ${session!.operator.displayName.split(" ")[0]}`} description="Your assigned incidents and incoming service alerts, all in one place." action={<span className={`status-pill status-${session!.operator.status.toLowerCase()}`}><i /> {STATUS_LABEL[session!.operator.status]}</span>} />
      <div className="stats-grid">
        <Metric label="Open incidents" value={active.length} icon={AlertTriangle} accent="orange" trend="Assigned to your service" />
        <Metric label="New alerts" value={needsAcceptance.length} icon={Bell} accent="blue" trend="Awaiting your acceptance" />
        <Metric label="In progress" value={alerts.filter((item) => ["ACCEPTED", "EN_ROUTE", "ON_SCENE"].includes(item.status)).length} icon={Radio} accent="purple" trend="Active interventions" />
        <Metric label="Resolved" value={alerts.filter((item) => item.status === "RESOLVED").length} icon={CheckCircle2} accent="green" trend="Completed responses" />
      </div>
      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">INCIDENT LOCATIONS</span><h2>Service activity</h2></div><Link to="/operator/incidents" className="text-link">All incidents <ArrowRight size={15} /></Link></div>
        <AlertLocationPanel alerts={active.slice(0, 5)} />
      </section>
      <div className="dashboard-columns">
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">NEEDS YOUR RESPONSE</span><h2>New alerts</h2></div><span className="count-bubble">{needsAcceptance.length}</span></div>
          {needsAcceptance.length ? <AlertRows alerts={needsAcceptance.slice(0, 4)} operatorView /> : <EmptyState icon={CheckCircle2} title="No alerts waiting" text="New incidents for your service will appear here." />}
        </section>
        <section className="card">
          <div className="card-heading"><div><span className="section-kicker">ACTIVE RESPONSE</span><h2>Interventions</h2></div><Link to="/operator/incidents" className="text-link">View all <ArrowRight size={14} /></Link></div>
          {active.filter((item) => item.status !== "SENT").length ? <AlertRows alerts={active.filter((item) => item.status !== "SENT").slice(0, 4)} operatorView /> : <EmptyState icon={Radio} title="No active interventions" text="Accepted incidents will be tracked here." />}
        </section>
      </div>
    </>
  );
}

function OperatorIncidents() {
  const { session } = useAuth();
  const load = useCallback(() => api.alerts(session!.token), [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading assigned incidents" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load incidents."} retry={resource.refresh} />;
  const alerts = resource.data;
  return (
    <>
      <PageHeading eyebrow={`${ROLE_LABEL[session!.operator.role].toUpperCase()} RESPONSE TEAM`} title="My incidents" description="Incidents shared with your service. Accept new calls and advance active interventions." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      {alerts.length ? <div className="incident-card-list">{alerts.map((alert) => <OperatorIncidentCard key={alert.id} alert={alert} onUpdated={resource.refresh} />)}</div> : <EmptyState icon={AlertTriangle} title="No incidents assigned" text="Your service incidents will appear here after the control room sends an alert." />}
    </>
  );
}

function OperatorAlerts() {
  const { session } = useAuth();
  const load = useCallback(() => api.alerts(session!.token), [session]);
  const resource = useResource(load);
  if (resource.loading) return <LoadingScreen label="Loading service alerts" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || "Unable to load alerts."} retry={resource.refresh} />;
  return (
    <>
      <PageHeading eyebrow="SERVICE DISPATCH" title="Incoming alerts" description="Review incidents for your service and accept available assignments." action={<button className="button button-secondary" onClick={resource.refresh}><RefreshCw size={15} /> Refresh</button>} />
      {resource.data.length ? <div className="card"><AlertRows alerts={resource.data} detailed operatorView onUpdated={resource.refresh} /></div> : <EmptyState icon={Bell} title="No incoming alerts" text="The control room has not dispatched an incident to your service." />}
    </>
  );
}

function OperatorIncidentDetail() {
  const { session } = useAuth();
  const { id } = useParams();
  const incidentId = Number(id);
  const incidentLoad = useCallback(() => api.incident(session!.token, incidentId), [session, incidentId]);
  const incidentResource = useResource(incidentLoad);
  const alertLoad = useCallback(async () => (await api.alerts(session!.token)).filter((item) => item.incidentId === incidentId), [session, incidentId]);
  const alertResource = useResource(alertLoad);
  if (!Number.isInteger(incidentId) || incidentId < 1) return <ErrorState message="Invalid incident reference." />;
  if (incidentResource.loading || alertResource.loading) return <LoadingScreen label="Opening incident details" />;
  if (incidentResource.error || !incidentResource.data) return <ErrorState message={incidentResource.error || "Incident not found."} retry={incidentResource.refresh} />;
  const incident = incidentResource.data;
  const alert = alertResource.data?.[0];
  return (
    <>
      <div className="back-row"><Link to="/operator/incidents" className="back-link"><ArrowLeft size={16} /> Back to my incidents</Link><span className="breadcrumb-sep">/</span><span>{incident.reference}</span></div>
      <PageHeading eyebrow={`${ROLE_LABEL[session!.operator.role].toUpperCase()} RESPONSE`} title={incident.reference} description={incident.location || "Location not provided"} action={<StatusBadge value={alert?.status || incident.status} />} />
      {alertResource.error && <InlineError message={alertResource.error} />}
      <div className="detail-grid">
        <section className="card video-card">
          <div className="card-heading"><div><span className="section-kicker">INCIDENT INFORMATION</span><h2>Situation details</h2></div><SeverityBadge value={incident.severity} /></div>
          <LocationBlock location={incident.location} latitude={incident.latitude} longitude={incident.longitude} />
          <div className="info-grid">
            <InfoItem label="Detected" value={displayDate(incident.detectedAt)} icon={Clock3} />
            <InfoItem label="Vehicles" value={String(incident.vehicles)} icon={Truck} />
            <InfoItem label="People" value={String(incident.people)} icon={Users} />
            <InfoItem label="Camera" value={incident.cameraId} icon={Radio} />
          </div>
          <div className="incident-flags"><span className={incident.possibleInjuries ? "flag-warning" : "flag-calm"}><i /> Possible injuries {incident.possibleInjuries ? "reported" : "not reported"}</span>{incident.fire && <span className="flag-warning"><Flame size={14} /> Fire detected</span>}</div>
          {incident.videoUrl && <video className="incident-video operator-video" controls preload="metadata" src={apiMediaUrl(incident.videoUrl)}>Your browser does not support video playback.</video>}
        </section>
        <section className="card response-status-card">
          <div className="card-heading"><div><span className="section-kicker">YOUR INTERVENTION</span><h2>Response progress</h2></div><span className="subtle-chip">{ROLE_LABEL[session!.operator.role]}</span></div>
          {alert ? <><StatusTimeline status={alert.status} /><AlertAction alert={alert} onUpdated={() => { void incidentResource.refresh(); void alertResource.refresh(); }} /></> : <EmptyState icon={Radio} title="No service alert found" text="This incident is not currently available to your service." />}
        </section>
      </div>
    </>
  );
}

function OperatorIncidentCard({ alert, onUpdated }: { alert: import("./domain").Alert; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { session, updateOperator } = useAuth();
  async function act(action: "accept" | "next") {
    if (action === "accept" && session!.operator.status !== "ACTIVE") {
      setError("Resume availability before accepting a new alert.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (action === "accept") await api.acceptAlert(session!.token, alert.id);
      else await api.updateAlert(session!.token, alert.id, nextAlertStatus(alert.status));
      try {
        updateOperator(await api.me(session!.token));
      } catch (caught) {
        setError(`Intervention updated, but operator status could not be refreshed: ${messageOf(caught)}`);
      }
      onUpdated();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="operator-incident-card">
      <div className="operator-incident-main">
        <div className="incident-list-icon">{serviceIcon(alert.serviceType)}</div>
        <div className="operator-card-copy"><div className="incident-title-line"><Link to={`/operator/incidents/${alert.incidentId}`} className="incident-reference">{alert.incidentReference}</Link><SeverityBadge value={alert.severity} /></div><p>{alert.location || "Location not provided"}</p><div className="operator-card-meta"><span><Clock3 size={13} /> Sent {displayDate(alert.sentAt)}</span><span><Truck size={13} /> {alert.vehicles} vehicles</span>{alert.possibleInjuries && <span className="injury-note"><AlertTriangle size={13} /> Possible injuries</span>}</div></div>
      </div>
      <div className="operator-card-side"><StatusBadge value={alert.status} />{alert.canAccept ? <button className="button button-primary button-small" disabled={busy || session!.operator.status !== "ACTIVE"} onClick={() => void act("accept")}>{busy ? <Spinner /> : <Check size={14} />} Accept alert</button> : alert.canUpdate ? <button className="button button-secondary button-small" disabled={busy} onClick={() => void act("next")}>{busy ? <Spinner /> : null} Update status <ArrowRight size={14} /></button> : <Link to={`/operator/incidents/${alert.incidentId}`} className="text-link">Details <ArrowRight size={14} /></Link>}</div>
      {alert.canAccept && session!.operator.status !== "ACTIVE" && <div className="availability-hint">Resume availability before accepting an alert.</div>}
      {error && <div className="operator-card-error"><InlineError message={error} /></div>}
    </article>
  );
}

function AlertAction({ alert, onUpdated }: { alert: import("./domain").Alert; onUpdated: () => void }) {
  const { session, updateOperator } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act() {
    setBusy(true);
    setError("");
    let actionSucceeded = false;
    try {
      if (alert.canAccept) await api.acceptAlert(session!.token, alert.id);
      else if (alert.canUpdate) await api.updateAlert(session!.token, alert.id, nextAlertStatus(alert.status));
      actionSucceeded = true;
      try {
        updateOperator(await api.me(session!.token));
      } catch (caught) {
        setError(`Intervention updated, but operator status could not be refreshed: ${messageOf(caught)}`);
      }
      onUpdated();
    } catch (caught) {
      if (!actionSucceeded) setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }
  if (alert.canAccept && session!.operator.status !== "ACTIVE") return <div className="status-complete"><Clock3 size={15} /> Set your status to Available before accepting.</div>;
  if (!alert.canAccept && !alert.canUpdate) return <div className="status-complete"><CheckCircle2 size={17} /> {alert.status === "RESOLVED" ? "Intervention resolved" : `Assigned to ${alert.assignedOperator || "another operator"}`}</div>;
  return <div className="status-action-block">{error && <InlineError message={error} />}<p className="muted">{alert.canAccept ? "Accept this alert to take responsibility for the intervention." : "Update the incident as your response progresses."}</p><button className="button button-primary button-wide" disabled={busy} onClick={() => void act()}>{busy ? <Spinner /> : alert.canAccept ? <Check size={16} /> : <ArrowRight size={16} />}{alert.canAccept ? "Accept this alert" : `Mark ${STATUS_LABEL[nextAlertStatus(alert.status)]}`} {!alert.canAccept && <ArrowRight size={15} />}</button></div>;
}

function nextAlertStatus(status: import("./domain").AlertStatus): import("./domain").AlertStatus {
  if (status === "ACCEPTED") return "EN_ROUTE";
  if (status === "EN_ROUTE") return "ON_SCENE";
  return "RESOLVED";
}

function StatusTimeline({ status }: { status: import("./domain").AlertStatus }) {
  const steps = ["ACCEPTED", "EN_ROUTE", "ON_SCENE", "RESOLVED"] as const;
  const current = steps.indexOf(status as typeof steps[number]);
  return <div className="status-timeline">{steps.map((step, index) => <div className={`timeline-step ${index <= current ? "timeline-done" : ""} ${index === current ? "timeline-current" : ""}`} key={step}><span className="timeline-marker">{index < current ? <Check size={13} /> : index + 1}</span><span>{STATUS_LABEL[step]}</span></div>)}</div>;
}

function IncidentTable({ incidents }: { incidents: Incident[] }) {
  return <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Incident</th><th>Location</th><th>Severity</th><th>Status</th><th>Assigned operator</th><th>Detected</th><th /></tr></thead><tbody>{incidents.map((incident) => <tr key={incident.id}><td><Link className="table-incident-link" to={`/admin/incidents/${incident.id}`}>{incident.reference}<small>{incident.cameraId}</small></Link></td><td><span className="table-location"><MapPin size={14} />{incident.location || "Location not provided"}</span></td><td><SeverityBadge value={incident.severity} /></td><td><StatusBadge value={incident.status} /></td><td>{incident.assignedAdmin || <span className="muted">Unassigned</span>}</td><td className="nowrap">{displayDate(incident.detectedAt)}</td><td><Link className="table-open" to={`/admin/incidents/${incident.id}`} aria-label={`Open ${incident.reference}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div></div>;
}

function IncidentList({ incidents, base }: { incidents: Incident[]; base: string }) {
  return <div className="compact-list">{incidents.map((incident) => <Link className="compact-list-row" key={incident.id} to={`${base}/${incident.id}`}><span className={`compact-severity severity-dot-${incident.severity.toLowerCase()}`} /><span className="compact-list-main"><strong>{incident.reference}</strong><small>{incident.location || "Location not provided"} · {displayDate(incident.detectedAt)}</small></span><StatusBadge value={incident.status} /><ArrowRight className="compact-chevron" size={15} /></Link>)}</div>;
}

function AlertRows({ alerts, detailed = false, operatorView = false, onUpdated }: { alerts: import("./domain").Alert[]; detailed?: boolean; operatorView?: boolean; onUpdated?: () => void }) {
  const incidentPath = (alert: import("./domain").Alert) => `${operatorView || alert.canAccept || alert.canUpdate ? "/operator" : "/admin"}/incidents/${alert.incidentId}`;
  return <div className={`alert-rows ${detailed ? "alert-rows-detailed" : ""}`}>{alerts.map((alert) => <div className="alert-row" key={alert.id}><div className={`service-avatar service-${alert.serviceType.toLowerCase()}`}>{serviceIcon(alert.serviceType)}</div><div className="alert-row-main"><Link to={incidentPath(alert)} className="incident-reference">{alert.incidentReference}</Link><span>{ROLE_LABEL[alert.serviceType]} <span className="muted">·</span> {alert.location || "Location not provided"}</span>{detailed && <small>Sent {displayDate(alert.sentAt)}{alert.assignedOperator ? ` · ${alert.assignedOperator}` : ""}</small>}</div><SeverityBadge value={alert.severity} /><StatusBadge value={alert.status} />{onUpdated && <div className="alert-row-action"><AlertAction alert={alert} onUpdated={onUpdated} /></div>}<Link className="table-open" to={incidentPath(alert)} aria-label={`Open ${alert.incidentReference}`}><ArrowRight size={15} /></Link></div>)}</div>;
}

function IncidentLocationPanel({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) return <div className="location-panel location-empty"><div className="empty-location-icon"><MapPin size={20} /></div><strong>Incident locations appear here</strong><span>When incidents are reported, their location and coordinates are listed for quick access.</span></div>;
  return <div className="location-panel"><div className="location-panel-head"><span><MapPin size={14} /> LOCATION REGISTER</span><span>COORDINATES FROM INCIDENT FEED</span></div><div className="location-grid">{incidents.map((incident) => <Link to={`/admin/incidents/${incident.id}`} className="location-item" key={incident.id}><span className={`location-marker marker-${incident.severity.toLowerCase()}`}><MapPin size={15} /></span><span className="location-copy"><strong>{incident.reference} <SeverityBadge value={incident.severity} /></strong><small>{incident.location || "Location not provided"}</small><small className="coordinate-line">{incident.latitude.toFixed(4)}°, {incident.longitude.toFixed(4)}° · {displayDate(incident.detectedAt)}</small></span><ArrowRight size={15} className="location-arrow" /></Link>)}</div></div>;
}

function AlertLocationPanel({ alerts }: { alerts: import("./domain").Alert[] }) {
  if (!alerts.length) return <div className="location-panel location-empty"><div className="empty-location-icon"><MapPin size={20} /></div><strong>No active service locations</strong><span>New alerts assigned to your service will appear here.</span></div>;
  return <div className="location-panel"><div className="location-panel-head"><span><MapPin size={14} /> SERVICE INCIDENTS</span><span>COORDINATES FROM INCIDENT FEED</span></div><div className="location-grid">{alerts.map((alert) => <Link to={`/operator/incidents/${alert.incidentId}`} className="location-item" key={alert.id}><span className={`location-marker marker-${alert.severity.toLowerCase()}`}>{serviceIcon(alert.serviceType)}</span><span className="location-copy"><strong>{alert.incidentReference} <SeverityBadge value={alert.severity} /></strong><small>{alert.location || "Location not provided"}</small><small className="coordinate-line">{alert.latitude.toFixed(4)}°, {alert.longitude.toFixed(4)}° · {STATUS_LABEL[alert.status]}</small></span><ArrowRight size={15} className="location-arrow" /></Link>)}</div></div>;
}

function OperatorRoster({ operators }: { operators: Operator[] }) {
  if (!operators.length) return <EmptyState icon={Users} title="No operator data" text="Operator availability could not be found." />;
  return <div className="roster">{operators.map((operator) => <div className="roster-row" key={operator.id}><Avatar name={operator.displayName} small /><span className="roster-copy"><strong>{operator.displayName}</strong><small>{ROLE_LABEL[operator.role]}</small></span><StatusBadge value={operator.status} /></div>)}</div>;
}

function LocationBlock({ location, latitude, longitude }: { location: string | null; latitude: number; longitude: number }) {
  const mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=15/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
  return <div className="location-block"><div className="location-icon"><MapPin size={18} /></div><div><span className="section-kicker">INCIDENT LOCATION</span><strong>{location || "Location not provided"}</strong><span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span></div><a href={mapUrl} target="_blank" rel="noreferrer" className="map-link">Open map <ArrowDownRight size={14} /></a></div>;
}

function Metric({ label, value, icon: Icon, accent, trend }: { label: string; value: string | number; icon: typeof Activity; accent: string; trend?: string }) {
  return <div className={`metric-card metric-${accent}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><strong className="metric-value">{value}</strong>{trend && <span className="metric-trend"><ArrowDownRight size={13} />{trend}</span>}</div>;
}

function InfoItem({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return <div className="info-item"><span className="info-icon"><Icon size={15} /></span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge badge-${value.toLowerCase()}`}><i />{STATUS_LABEL[value] || value.replace(/_/g, " ")}</span>;
}

function SeverityBadge({ value }: { value: string }) {
  return <span className={`severity-badge severity-${value.toLowerCase()}`}><i />{value}</span>;
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={`avatar ${small ? "avatar-small" : ""}`}>{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error" role="alert"><AlertTriangle size={16} /><span>{message}</span></div>;
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-state"><span className="error-state-icon"><AlertTriangle size={21} /></span><h2>We couldn't load this view</h2><p>{message}</p>{retry && <button className="button button-secondary" onClick={retry}><RefreshCw size={15} /> Try again</button>}</div>;
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="loading-state"><Spinner /><span>{label}</span></div>;
}

function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load().then((value) => {
      if (active) setData(value);
    }).catch((caught: unknown) => {
      if (active) setError(messageOf(caught));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load, revision]);

  useEffect(() => {
    const timer = window.setInterval(() => setRevision((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return { data, loading, error, refresh };
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function serviceIcon(service: Service): ReactNode {
  if (service === "POLICE") return <Shield size={17} />;
  if (service === "AMBULANCE") return <Activity size={17} />;
  if (service === "POMPIERS") return <Flame size={17} />;
  return <Truck size={17} />;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
}
