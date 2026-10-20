import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import logo from "../assets/nexora-logo.webp";
import { ROLE_LABELS, ROLES } from "../labels";
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
      <img className="login-logo" src={logo} alt="Nexora" />
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <div className="login-brand">
          <div className="brand-name">Nexora SafeRoad</div>
          <div className="brand-area">Accident detection and response</div>
        </div>

        <label className="field">
          <span>Sign in as</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="notice error">{error}</div>}
        <button type="submit" className="button primary wide" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {import.meta.env.DEV && (
          <p className="hint">Demo accounts: admin1, police1, ambulance1, pompiers1, depannage1 — password "saferoad".</p>
        )}
      </form>
    </div>
  );
}
