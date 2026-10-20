import { formatTime, stationDistance } from "../format";
import { ALERT_FLOW, ALERT_STATUS_LABELS, SERVICE_LABELS } from "../labels";
import type { IncidentAlert } from "../types/api";

/** Where each alerted service is in its intervention (README "Service Operator Intervention Status"). */
export function AlertProgress({ alerts }: { alerts: IncidentAlert[] }) {
  return (
    <ul className="alert-progress">
      {alerts.map((alert) => {
        const reached = ALERT_FLOW.indexOf(alert.status);
        return (
          <li key={alert.id}>
            <div className="progress-head">
              <strong>{SERVICE_LABELS[alert.serviceType]}</strong>
              {alert.station && (
                <span>
                  {alert.station.name} · {stationDistance(alert.station)}
                </span>
              )}
              <span className="muted">
                {alert.assignedOperator ?? "Waiting for an operator"} · sent {formatTime(alert.sentAt)}
              </span>
            </div>
            <ol className="steps">
              {ALERT_FLOW.map((step, index) => (
                <li key={step} className={index <= reached ? "done" : undefined}>
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
