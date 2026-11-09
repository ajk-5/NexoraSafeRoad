import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { OperatorStatusBadge } from "../../components/Badges";
import { Icon } from "../../components/Icon";
import { Card, DataView, Disclosure, Notice, PageHeader } from "../../components/ui";
import { incidentReference, timeAgo } from "../../format";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "../../labels";
import { workspacePath } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { useOperator } from "../../services/auth";
import { usePolling } from "../../services/usePolling";
import { PASSWORD_REQUIREMENTS, passwordError } from "../../services/passwordPolicy";
import type { Operator, Role } from "../../types/api";

/** Every account: create new ones, and see who is available and working on what. */
export function SuperadminAccounts() {
  const me = useOperator();
  const operators = usePolling(() => api.operators(), []);
  return (
    <>
      <PageHeader description="Create accounts for operators and service operators, and see everyone's availability. Operators change their own availability with Pause / Resume." />
      <CreateAccount onCreated={operators.reload} />
      <DataView data={operators.data} error={operators.error} onRetry={operators.reload}>
        {(list) => <OperatorsTable operators={list} me={me} />}
      </DataView>
      <Card title="How work is assigned" icon="info">
        <ul className="rules">
          <li>A new incident goes straight to an <strong>available</strong> operator; with several, the one who waited longest gets it.</li>
          <li>
            When nobody is available, incidents wait in a queue and are handed out <strong>most severe first</strong>, then oldest
            first.
          </li>
          <li>An incident is locked to its operator: other operators can view it but not change it. The server enforces this.</li>
          <li>
            <strong>Paused</strong> and <strong>offline</strong> operators get nothing new. Pausing keeps the work in hand; an operator can
            also return their incident to the queue.
          </li>
          <li>
            An operator whose session stops responding (about 2 minutes by default) loses the lock, and the incident goes to the next
            available operator.
          </li>
          <li>Super admins run the platform (accounts, AI training, statistics) and are never assigned incidents.</li>
        </ul>
        <Disclosure summary="Service operators" icon="users">
          <p>
            An alert is visible to every operator of its service. The first <strong>available</strong> one to accept it handles it;
            each service operator handles one intervention at a time.
          </p>
        </Disclosure>
      </Card>
    </>
  );
}

const EMPTY = { displayName: "", username: "", role: "ADMIN" as Role, password: "", confirm: "" };

/** The new account's details; the server checks them again (unique username, password length). */
export function CreateAccount({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Operator | null>(null);
  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  const mismatch = form.confirm !== "" && form.confirm !== form.password;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || mismatch) return;
    const invalid = passwordError(form.password);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const account = await api.createOperator({
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        role: form.role,
        password: form.password,
      });
      setCreated(account);
      setForm({ ...EMPTY, role: form.role });
      onCreated();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Create an account" icon="user">
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label className="field-label" htmlFor="acc-name">
            Full name
          </label>
          <input id="acc-name" className="input" value={form.displayName} onChange={set("displayName")} maxLength={100} required placeholder="e.g. Police Operator 02" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="acc-username">
            Username
          </label>
          <input
            id="acc-username"
            className="input"
            value={form.username}
            onChange={set("username")}
            minLength={3}
            maxLength={64}
            pattern="[a-zA-Z0-9._\-]+"
            required
            autoComplete="off"
            aria-describedby="username-hint"
            placeholder="e.g. police2"
          />
          <span className="field-hint" id="username-hint">
            Letters, numbers, dots, dashes and underscores. Used to sign in.
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="acc-role">
            Role
          </label>
          <select id="acc-role" className="select" value={form.role} onChange={set("role")} aria-describedby="new-role-hint">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <span className="field-hint" id="new-role-hint">
            {ROLE_DESCRIPTIONS[form.role]}
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="acc-password">
            Password
          </label>
          <input
            id="acc-password"
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            minLength={15}
            maxLength={128}
            required
            autoComplete="new-password"
            aria-describedby="password-hint"
          />
          <span className="field-hint" id="password-hint">
            {PASSWORD_REQUIREMENTS} Share it with the person directly.
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="acc-confirm">
            Confirm password
          </label>
          <input
            id="acc-confirm"
            className="input"
            type="password"
            value={form.confirm}
            onChange={set("confirm")}
            required
            autoComplete="new-password"
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "confirm-error" : undefined}
          />
          {mismatch && (
            <span className="error-text" id="confirm-error">
              The two passwords are different.
            </span>
          )}
        </div>
        <div className="account-form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || mismatch}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size="sm" />}
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
      {error && (
        <Notice tone="error" live="alert">
          {error}
        </Notice>
      )}
      {created && (
        <Notice tone="success" live="status">
          Account <strong>{created.username}</strong> created ({ROLE_LABELS[created.role]}). They can sign in now.
        </Notice>
      )}
    </Card>
  );
}

function OperatorsTable({ operators, me }: { operators: Operator[]; me: Operator }) {
  const byRole = useMemo(() => {
    const groups = new Map<Role, Operator[]>();
    for (const role of ROLES) groups.set(role, operators.filter((o) => o.role === role));
    return groups;
  }, [operators]);

  return (
    <Card flush title={`Accounts (${operators.length})`} icon="users">
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Accounts and their availability</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Availability</th>
              <th scope="col">Working on</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.flatMap((role) => byRole.get(role) ?? []).map((operator) => (
              <tr key={operator.id}>
                <td>
                  <span className="strong">{operator.displayName}</span>
                  {operator.id === me.id && <span className="you-tag"> You</span>}
                  <span className="cell-sub mono">{operator.username}</span>
                </td>
                <td>{ROLE_LABELS[operator.role]}</td>
                <td>
                  <OperatorStatusBadge status={operator.status} />
                </td>
                <td>
                  {operator.currentIncidentId === null ? (
                    <span className="subtle">—</span>
                  ) : (
                    <Link to={workspacePath("SUPERADMIN", operator.currentIncidentId)} className="mono">
                      {incidentReference(operator.currentIncidentId)}
                    </Link>
                  )}
                </td>
                <td>{operator.lastSeenAt ? timeAgo(operator.lastSeenAt) : <span className="subtle">Never</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
