import { useState, type FormEvent } from "react";

import { errorMessage } from "../services/api";
import { useAuth } from "../services/auth";
import { PASSWORD_REQUIREMENTS, passwordError } from "../services/passwordPolicy";
import { Card, Notice } from "./ui";

export function ChangePassword() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(false);
    const invalid = passwordError(password);
    if (invalid) { setError(invalid); return; }
    if (password !== confirm) { setError("The two passwords are different."); return; }
    setBusy(true);
    try {
      await changePassword(current, password);
      setCurrent(""); setPassword(""); setConfirm("");
      setSuccess(true);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return (
    <Card title="Change password">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <label className="field"><span className="field-label">Current password</span>
          <input className="input" type="password" autoComplete="current-password" maxLength={128} value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </label>
        <label className="field"><span className="field-label">New password</span>
          <input className="input" type="password" autoComplete="new-password" aria-describedby="new-password-hint" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <p className="field-hint" id="new-password-hint">{PASSWORD_REQUIREMENTS}</p>
        <label className="field"><span className="field-label">Confirm new password</span>
          <input className="input" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </label>
        {error && <Notice tone="error" live="alert">{error}</Notice>}
        {success && <Notice tone="success" live="status">Password updated. Your session has been secured with a new token.</Notice>}
        <div><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></div>
      </form>
    </Card>
  );
}
