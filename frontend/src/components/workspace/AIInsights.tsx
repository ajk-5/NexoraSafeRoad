import { aiPrediction, injuryFlagReason, severityExplanation } from "../../domain/incidents";
import { formatTime, percent } from "../../format";
import { SERVICE_SHORT_LABELS } from "../../labels";
import type { Incident } from "../../types/api";
import { AiTag, SeverityBadge } from "../Badges";
import { Icon, type IconName } from "../Icon";
import { Card, Disclosure } from "../ui";

/**
 * What the AI predicted, kept apart from what a person verified and from what nobody knows yet.
 * Nothing here is invented: unknown facts say "Unknown".
 */
export function AIInsights({ incident }: { incident: Incident }) {
  const injuryReason = injuryFlagReason(incident);
  const severityRule = severityExplanation(incident);

  return (
    <Card title="AI assessment" icon="sparkles" actions={<AiTag>AI prediction · not verified</AiTag>} className="ai-card">
      <dl className="ai-grid">
        <div>
          <dt>Predicted type</dt>
          <dd>{aiPrediction(incident)}</dd>
        </div>
        <div>
          <dt>Estimated severity</dt>
          <dd>
            <SeverityBadge severity={incident.severity} />
          </dd>
        </div>
        <div>
          <dt>Model confidence</dt>
          <dd>
            <span className="confidence">
              <span className="num strong">{percent(incident.confidence)}</span>
              <span className="confidence-bar" aria-hidden="true">
                <span style={{ width: percent(incident.confidence) }} />
              </span>
            </span>
          </dd>
        </div>
      </dl>

      <div className="observations" aria-label="What the AI saw">
        <Observation icon="car" label={`${incident.vehicles} vehicle${incident.vehicles === 1 ? "" : "s"}`} />
        <Observation icon="person" label={incident.people === 0 ? "No people visible" : `${incident.people} ${incident.people === 1 ? "person" : "people"} visible`} />
        <Observation icon="flame" label={incident.fire ? "Fire detected" : "No fire detected"} active={incident.fire} />
        <Observation icon="alert" label={incident.overturned ? "Overturned vehicle" : "No overturned vehicle"} active={incident.overturned} />
      </div>

      <div className="verification">
        <div className="verification-row">
          <span className="verification-label">Operator verification</span>
          <span className="verification-value">
            <HumanVerdict incident={incident} />
          </span>
        </div>
        <div className="verification-row">
          <span className="verification-label">Injuries · lanes blocked</span>
          <span className="verification-value">
            <strong>Unknown</strong> — not verified on scene.
            {injuryReason && <span className="muted"> AI flag: possible injuries. {injuryReason}</span>}
          </span>
        </div>
      </div>

      {incident.suggestedServices.length > 0 && (
        <div className="ai-services">
          <span className="verification-label">AI recommends</span>
          <ul className="chips">
            {incident.suggestedServices.map((s) => (
              <li key={s.service} className="chip" title={s.reason}>
                {SERVICE_SHORT_LABELS[s.service]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Disclosure summary="Why did the AI flag this?" icon="info">
        <p>
          The video detector reported an accident after seeing it in several consecutive frames. It then counted the
          vehicles and people in the picture and looked for fire and overturned vehicles.
        </p>
        <p>
          <strong>Severity</strong> comes from fixed rules on those counts, not from a separate model: High with fire, an
          overturned vehicle, 2 or more people or 3 or more vehicles; Medium with 2 vehicles or 1 person; Low otherwise.
          {severityRule && ` ${severityRule}`}
        </p>
        <p>
          <strong>Model confidence</strong> ({percent(incident.confidence)}) is the detector's score for what it saw in the
          frames. It is not the probability that an accident really happened — always check the clip.
        </p>
        {incident.suggestedServices.length > 0 && (
          <ul>
            {incident.suggestedServices.map((s) => (
              <li key={s.service}>
                <strong>{SERVICE_SHORT_LABELS[s.service]}</strong>: {s.reason}
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </Card>
  );
}

function Observation({ icon, label, active }: { icon: IconName; label: string; active?: boolean }) {
  return (
    <span className={`observation${active ? " active" : ""}`}>
      <Icon name={icon} size="sm" />
      {label}
    </span>
  );
}

function HumanVerdict({ incident }: { incident: Incident }) {
  const by = incident.assignedAdmin ? ` by ${incident.assignedAdmin}` : "";
  if (incident.status === "DECLINED") {
    return (
      <span className="verdict rejected">
        <Icon name="x" size="sm" />
        Rejected as a false alarm{by}
        {incident.decidedAt && ` at ${formatTime(incident.decidedAt)}`}
      </span>
    );
  }
  const confirmedAt = incident.confirmedAt ?? (incident.alerts.length > 0 ? incident.decidedAt : null);
  if (confirmedAt !== null) {
    return (
      <span className="verdict confirmed">
        <Icon name="check" size="sm" />
        Confirmed as a real accident{by} at {formatTime(confirmedAt)}
      </span>
    );
  }
  return <span className="verdict pending">Not verified yet — this is only the AI's suspicion.</span>;
}
