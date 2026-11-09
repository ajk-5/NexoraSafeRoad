import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import emblem from "../assets/nexora-emblem.webp";
import logo from "../assets/nexora-logo.webp";
import { Notice } from "../components/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "../labels";
import { homePath } from "../paths";
import { errorMessage } from "../services/api";
import { useAuth } from "../services/auth";
import type { Role } from "../types/api";

export function Login() {
  const { operator, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("ADMIN");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (operator) return <Navigate to={homePath(operator.role)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(role, username.trim(), password);
      void navigate(homePath(signedIn.role), { replace: true });
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-brand" aria-label="Nexora SafeRoad">
        <img className="login-logo" src={logo} alt="Nexora" />
        <div className="login-pitch">
          <h1>SafeRoad</h1>
          <p>AI-assisted road accident detection and response. The AI spots possible accidents; people confirm them and decide who to alert.</p>
        </div>
        <img className="login-emblem" src={emblem} alt="" />
      </section>

      <main className="login-main">
        <form className="login-card" onSubmit={(event) => void submit(event)} aria-labelledby="login-title">
          <div>
            <h2 id="login-title">Sign in</h2>
            <p className="muted">Choose your role, then enter your account.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-role">
              Sign in as
            </label>
            <select id="login-role" className="select" value={role} onChange={(event) => setRole(event.target.value as Role)} aria-describedby="role-hint">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <span className="field-hint" id="role-hint">
              {ROLE_DESCRIPTIONS[role]}
            </span>
          </div>

          <label className="field">
            <span className="field-label">Username</span>
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <Notice tone="error" live="alert">
              {error}
            </Notice>
          )}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
