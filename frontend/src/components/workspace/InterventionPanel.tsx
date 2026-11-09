import { useState } from "react";

import { formatTime, incidentReference, stationDistance } from "../../format";
import { ALERT_FLOW, ALERT_STATUS_LABELS, NEXT_STEP, SERVICE_LABELS } from "../../labels";
import { api, errorMessage, isConflict, isNetworkError } from "../../services/api";
import type { Alert, AlertUpdate, Operator } from "../../types/api";
import { ConfirmDialog } from "../Dialog";
import { Icon } from "../Icon";
import { Notice } from "../ui";

interface Props {
  /** This service's alert for the incident; null if the service was not alerted. */
  alert: Alert | null;
  operator: Pick<Operator, "status" | "currentIncidentId" | "displayName">;
  incidentId: number;
  /** After an action or a conflict: reload the alert, the operator and the queue. */
  onChanged: () => void;
}

/** A service operator's side of an incident: accept the alert, then report progress until resolved. */
export function InterventionPanel({ alert, operator, incidentId, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);

  if (alert === null) {
    return (
      <section className="card decision-card">
        <div className="card-body">
          <Notice tone="info">Your service was not alerted for this incident.</Notice>
        </div>
      </section>
    );
  }

  const next = alert.canUpdate ? NEXT_STEP[alert.status] : undefined;
  const reached = ALERT_FLOW.indexOf(alert.status);

  const run = async (call: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      await call();
      setConfirmResolve(false);
      setResult({ tone: "success", text: success });
      onChanged();
    } catch (failure) {
      setConfirmResolve(false);
      const text = isNetworkError(failure)
        ? "Connection lost — the server did not confirm this. Check the status before trying again."
        : errorMessage(failure);
      setResult({ tone: "error", text });
      if (isConflict(failure)) onChanged();
    } finally {
      setBusy(false);
    }
  };

  const accept = () => run(() => api.acceptAlert(alert.id), "Accepted. This intervention is yours.");
  const advance = (status: AlertUpdate) => run(() => api.updateAlert(alert.id, status), `Status updated: ${ALERT_STATUS_LABELS[status]}.`);

  // Why Accept is not possible right now, if it is not.
  const blocked =
    operator.status === "PAUSED"
      ? "You are paused. Resume to accept new alerts."
      : operator.currentIncidentId !== null && operator.currentIncidentId !== incidentId
        ? `Finish your current intervention (${incidentReference(operator.currentIncidentId)}) before accepting a new one.`
        : null;
  const takenByOther = alert.status !== "SENT" && !alert.canUpdate && alert.assignedOperator !== operator.displayName;

  return (
    <section className="card decision-card" aria-labelledby="intervention-title">
      <div className="card-header">
        <h2 id="intervention-title">
          <Icon name="siren" />
          {SERVICE_LABELS[alert.serviceType]} intervention
        </h2>
      </div>
      <div className="card-body decision-body">
        {result && (
          <Notice tone={result.tone} live={result.tone === "error" ? "alert" : "status"}>
            {result.text}
          </Notice>
        )}

        <ol className="intervention-steps" aria-label={`Status: ${ALERT_STATUS_LABELS[alert.status]}`}>
          {ALERT_FLOW.map((step, index) => (
            <li key={step} className={index < reached ? "done" : index === reached ? "current" : undefined} aria-current={index === reached ? "step" : undefined}>
              <span className="step-number" aria-hidden="true">
                {index < reached ? <Icon name="check" size="sm" /> : index + 1}
              </span>
              {step === "SENT" ? "Alert received" : ALERT_STATUS_LABELS[step]}
            </li>
          ))}
        </ol>

        {alert.station && (
          <div className="responding-station">
            <span className="section-title">Responding station</span>
            <strong>{alert.station.name}</strong>
            <span className="small muted">
              {alert.station.address ? `${alert.station.address} · ` : ""}
              {stationDistance(alert.station)} from the incident (rough estimate)
            </span>
          </div>
        )}

        {alert.canAccept && (
          <div className="decision-actions">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void accept()} disabled={busy || blocked !== null} aria-describedby={blocked ? "accept-blocked" : undefined}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
              {busy ? "Accepting…" : "Accept this alert"}
            </button>
            {blocked && (
              <p className="field-hint" id="accept-blocked">
                {blocked}
              </p>
            )}
          </div>
        )}

        {next && (
          <div className="decision-actions">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void advance(next.status)} disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {next.label}
            </button>
            {next.status !== "RESOLVED" && (
              <div className="decision-secondary">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmResolve(true)} disabled={busy}>
                  Mark resolved now
                </button>
              </div>
            )}
          </div>
        )}

        {takenByOther && (
          <div className="lock-notice">
            <Icon name="lock" />
            <div>
              <div className="strong">Accepted by {alert.assignedOperator ?? "another operator"}</div>
              <p className="small muted">Only they can update this intervention.</p>
            </div>
          </div>
        )}

        {alert.status === "RESOLVED" && alert.resolvedAt && (
          <Notice tone="success">Resolved at {formatTime(alert.resolvedAt)}.</Notice>
        )}
      </div>

      {confirmResolve && (
        <ConfirmDialog
          title="Mark the intervention resolved?"
          icon="check"
          confirmLabel="Mark resolved"
          busyLabel="Saving…"
          busy={busy}
          onConfirm={() => void advance("RESOLVED")}
          onCancel={() => setConfirmResolve(false)}
        >
          <p>
            This skips the remaining steps and ends your intervention on <strong className="mono">{incidentReference(incidentId)}</strong>.
            It cannot be reopened.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
