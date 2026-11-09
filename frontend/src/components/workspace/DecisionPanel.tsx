import { useEffect, useState } from "react";

import { incidentTitle, reviewStage, type ReviewAction, type ReviewStage } from "../../domain/incidents";
import { formatTime, incidentReference, locationLabel, stationDistance } from "../../format";
import { SERVICE_LABELS } from "../../labels";
import { api, errorMessage, isConflict, isNetworkError } from "../../services/api";
import type { Incident, Operator, ServiceType, Station, StationChoice } from "../../types/api";
import { AlertProgress } from "../AlertProgress";
import { ConfirmDialog } from "../Dialog";
import { Icon } from "../Icon";
import { Notice } from "../ui";
import { ServiceSelector } from "./ServiceSelector";

type NearbyStations = Partial<Record<ServiceType, Station[]>>;

interface Props {
  incident: Incident;
  viewer: Pick<Operator, "status" | "currentIncidentId">;
  selected: ServiceType[];
  onSelect: (services: ServiceType[]) => void;
  nearby: NearbyStations | undefined;
  /** The station that responds for each selected service. */
  chosen: Partial<Record<ServiceType, Station>>;
  onChooseStation: (service: ServiceType, stationId: string) => void;
  /** After an action or a conflict: reload the incident and the queue. */
  onChanged: () => void;
}

interface Result {
  tone: "success" | "error";
  text: string;
}

/**
 * The operator's decision, one step at a time: confirm a real accident (or reject a false alarm),
 * then choose the services, then confirm sending the alert in a dialog. Only the actions
 * valid for the incident's state and this operator are shown, and success is only reported after
 * the backend confirmed it.
 */
export function DecisionPanel({ incident, viewer, selected, onSelect, nearby, chosen, onChooseStation, onChanged }: Props) {
  const stage = reviewStage(incident);
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dialog, setDialog] = useState<"dispatch" | "reject" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // The incident left this operator's hands (decided, or the lock moved): close any open dialog.
  const editable = stage.kind === "verify" || stage.kind === "dispatch";
  useEffect(() => {
    if (!editable) setDialog(null);
  }, [editable]);

  const run = async (action: ReviewAction, call: () => Promise<unknown>, success: string) => {
    if (busy !== null) return; // never two submissions at once
    setBusy(action);
    setDialogError(null);
    setResult(null);
    try {
      await call();
      setDialog(null);
      setResult({ tone: "success", text: success });
      onChanged();
    } catch (failure) {
      const text = failureMessage(action, failure);
      if (isConflict(failure)) {
        setDialog(null); // someone else changed it: show the current state, not the dialog
        setResult({ tone: "error", text });
        onChanged();
      } else if (dialog !== null) {
        setDialogError(text);
      } else {
        setResult({ tone: "error", text });
      }
    } finally {
      setBusy(null);
    }
  };

  const services = selected.map((s) => SERVICE_LABELS[s]).join(", ");
  const stations = stationIds(selected, chosen);
  const confirm = () => run("confirm", () => api.confirm(incident.id), "Confirmed as a real accident. Now choose who to alert.");
  const save = () => run("save", () => api.saveDraft(incident.id, selected, stations), `Review saved at ${formatTime(new Date().toISOString())}.`);
  const dispatch = () => run("dispatch", () => api.sendAlert(incident.id, selected, stations), `Alert sent to ${services}.`);
  const reject = () => run("reject", () => api.decline(incident.id), "Rejected as a false alarm. No service was alerted.");

  return (
    <section className="card decision-card" aria-labelledby="decision-title">
      <div className="card-header">
        <h2 id="decision-title">
          <Icon name="shieldCheck" />
          {stage.kind === "decided" ? "Outcome" : editable ? "Your decision" : "Decision"}
        </h2>
      </div>
      <div className="card-body decision-body">
        {result && (
          <Notice tone={result.tone} live={result.tone === "error" ? "alert" : "status"}>
            {result.text}
          </Notice>
        )}

        {stage.kind === "verify" && (
          <>
            <Steps current={1} />
            <p className="decision-prompt">Watch the clip. Is this a real accident?</p>
            <div className="decision-actions">
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void confirm()} disabled={busy !== null}>
                {busy === "confirm" ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
                {busy === "confirm" ? "Confirming…" : "Confirm accident"}
              </button>
              <button type="button" className="btn btn-danger-outline btn-lg btn-block" onClick={() => setDialog("reject")} disabled={busy !== null}>
                <Icon name="x" />
                False alarm
              </button>
            </div>
            <p className="decision-hint">Confirming does not alert anyone yet: you choose the services next.</p>
          </>
        )}

        {stage.kind === "dispatch" && (
          <>
            <Steps current={2} />
            <p className="decision-prompt">Choose who to alert. The AI's suggestion is selected; change it if the clip shows otherwise.</p>
            <ServiceSelector
              suggested={incident.suggestedServices}
              selected={selected}
              onChange={onSelect}
              nearby={nearby}
              chosen={chosen}
              onChooseStation={onChooseStation}
              disabled={busy !== null}
            />
            <div className="decision-actions pinned">
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => setDialog("dispatch")}
                disabled={busy !== null || selected.length === 0}
                aria-describedby={selected.length === 0 ? "no-service-hint" : undefined}
              >
                <Icon name="send" />
                Send alert…
              </button>
              {selected.length === 0 && (
                <p className="field-hint" id="no-service-hint">
                  Select at least one service, or reject the incident as a false alarm.
                </p>
              )}
              <div className="decision-secondary">
                <button type="button" className="btn btn-secondary" onClick={() => void save()} disabled={busy !== null}>
                  {busy === "save" && <span className="spinner" aria-hidden="true" />}
                  Save review
                </button>
                <button type="button" className="btn btn-danger-outline" onClick={() => setDialog("reject")} disabled={busy !== null}>
                  False alarm
                </button>
              </div>
            </div>
          </>
        )}

        {stage.kind === "waiting" && <WaitingNotice incident={incident} viewer={viewer} />}
        {stage.kind === "readOnly" && <ReadOnlyNotice stage={stage} />}
        {stage.kind === "decided" && <Outcome incident={incident} />}
      </div>

      {dialog === "dispatch" && (
        <ConfirmDialog
          title="Send the alert?"
          icon="send"
          confirmLabel="Send alert"
          busyLabel="Sending…"
          busy={busy === "dispatch"}
          error={dialogError}
          onConfirm={() => void dispatch()}
          onCancel={() => setDialog(null)}
        >
          <dl className="summary-list">
            <dt>Incident</dt>
            <dd>
              <span className="mono">{incident.reference}</span> · {incidentTitle(incident)}
            </dd>
            <dt>Location</dt>
            <dd>{locationLabel(incident)}</dd>
            <dt>Alert</dt>
            <dd>
              <ul>
                {selected.map((service) => {
                  const station = chosen[service];
                  return (
                    <li key={service}>
                      <strong>{SERVICE_LABELS[service]}</strong>
                      {station ? ` — ${station.name} (${stationDistance(station)})` : " — no station on record"}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </dl>
          <p>The selected services receive the alert in their console straight away. This closes your review, and the alert cannot be taken back.</p>
        </ConfirmDialog>
      )}

      {dialog === "reject" && (
        <ConfirmDialog
          title="Reject as a false alarm?"
          icon="x"
          tone="danger"
          confirmLabel="Reject as false alarm"
          busyLabel="Rejecting…"
          busy={busy === "reject"}
          error={dialogError}
          onConfirm={() => void reject()}
          onCancel={() => setDialog(null)}
        >
          <p>
            <strong className="mono">{incident.reference}</strong> will be closed and <strong>no service will be alerted</strong>. This
            cannot be undone.
          </p>
          <p>Its clip may later be used as a false-alarm example when the AI is retrained.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function failureMessage(action: ReviewAction, failure: unknown): string {
  if (isNetworkError(failure)) {
    return action === "dispatch"
      ? "Alert not confirmed — the server did not answer. Check the incident's status before trying again."
      : "Connection lost — the server did not confirm this action. Check the incident's status before trying again.";
  }
  if (isConflict(failure)) return `${errorMessage(failure)} The latest state is shown.`;
  return errorMessage(failure);
}

const STEPS = ["Verify the clip", "Choose services", "Send the alert"];

function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="decision-steps" aria-label={`Step ${current} of ${STEPS.length}`}>
      {STEPS.map((label, index) => {
        const n = index + 1;
        return (
          <li key={label} className={n < current ? "done" : n === current ? "current" : undefined} aria-current={n === current ? "step" : undefined}>
            <span className="step-number" aria-hidden="true">
              {n < current ? <Icon name="check" size="sm" /> : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function WaitingNotice({ incident, viewer }: { incident: Incident; viewer: Props["viewer"] }) {
  let extra = "";
  if (viewer.status === "PAUSED") extra = " You are paused: resume to receive incidents.";
  else if (viewer.currentIncidentId !== null && viewer.currentIncidentId !== incident.id) {
    extra = ` You will receive new incidents after you finish ${incidentReference(viewer.currentIncidentId)}.`;
  }
  return (
    <Notice tone="info" title="Waiting for an available operator">
      It is assigned automatically to the next available operator, most severe first.{extra}
    </Notice>
  );
}

function ReadOnlyNotice({ stage }: { stage: Extract<ReviewStage, { kind: "readOnly" }> }) {
  return (
    <div className="lock-notice">
      <Icon name="lock" />
      <div>
        <div className="strong">Currently handled by {stage.by ?? "another operator"}</div>
        <p className="small muted">You can view this incident, but only the operator it is assigned to can decide. Nothing you do here changes it.</p>
      </div>
    </div>
  );
}

function Outcome({ incident }: { incident: Incident }) {
  const by = incident.assignedAdmin ? ` by ${incident.assignedAdmin}` : "";
  const at = incident.decidedAt ? ` at ${formatTime(incident.decidedAt)}` : "";
  if (incident.status === "DECLINED") {
    return (
      <div className="outcome">
        <div className="outcome-title">
          <Icon name="x" />
          Rejected as a false alarm{by}
          {at}
        </div>
        <p className="small muted">No service was alerted.</p>
      </div>
    );
  }
  return (
    <div className="outcome">
      <div className="outcome-title">
        <Icon name="send" />
        Alert sent{by}
        {at}
      </div>
      <p className="small muted">{incident.status === "RESOLVED" ? "Every alerted service resolved its intervention." : "Service progress updates here automatically."}</p>
      <AlertProgress alerts={incident.alerts} />
    </div>
  );
}

/** The station picked for each selected service, by id, as the backend expects. */
function stationIds(services: ServiceType[], chosen: Partial<Record<ServiceType, Station>>): StationChoice {
  const ids: StationChoice = {};
  for (const service of services) {
    const station = chosen[service];
    if (station) ids[service] = station.id;
  }
  return ids;
}
