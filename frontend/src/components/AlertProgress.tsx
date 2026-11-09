import { formatTime, stationDistance } from "../format";
import { ALERT_FLOW, ALERT_STATUS_LABELS, SERVICE_LABELS } from "../labels";
import type { IncidentAlert } from "../types/api";

/** Where each alerted service is in its intervention: Sent → Accepted → En route → On scene → Resolved. */
export function AlertProgress({ alerts }: { alerts: IncidentAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="alert-progress">
      {alerts.map((alert) => {
        const reached = ALERT_FLOW.indexOf(alert.status);
        return (
          <li key={alert.id}>
            <div className="progress-head">
              <strong>{SERVICE_LABELS[alert.serviceType]}</strong>
              <span className="small muted">
                {alert.assignedOperator ? `Accepted by ${alert.assignedOperator}` : "Waiting for an operator to accept"} · sent{" "}
                {formatTime(alert.sentAt)}
              </span>
              {alert.station && (
                <span className="small muted">
                  {alert.station.name} · {stationDistance(alert.station)}
                </span>
              )}
            </div>
            <ol className="steps" aria-label={`${SERVICE_LABELS[alert.serviceType]}: ${ALERT_STATUS_LABELS[alert.status]}`}>
              {ALERT_FLOW.map((step, index) => (
                <li key={step} className={index < reached ? "done" : index === reached ? "current" : undefined}>
                  {step === "SENT" ? "Sent" : ALERT_STATUS_LABELS[step]}
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}
