import { useRef, useState } from "react";

import { incidentReference } from "../../format";
import { api, errorMessage } from "../../services/api";
import type { Operator } from "../../types/api";
import { OperatorStatusBadge } from "../Badges";
import { ConfirmDialog, Modal } from "../Dialog";
import { Icon } from "../Icon";
import { Notice } from "../ui";

interface Props {
  operator: Operator;
  /** Called with the operator as the backend returned it after each change. */
  onUpdate: (operator: Operator) => void;
}

/**
 * Available / Paused. Pausing never silently drops work: with an incident or intervention in hand
 * the operator is told what happens to it, and an operator can hand their incident back to the queue.
 */
export function AvailabilityControl({ operator, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const paused = operator.status === "PAUSED";
  const held = operator.currentIncidentId;
  const isAdmin = operator.role === "ADMIN";

  const pause = async (release: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Pause first: once paused, a released incident cannot come straight back to this operator.
      onUpdate(await api.pause());
      if (release && held !== null) {
        try {
          await api.release(held);
        } catch (failure) {
          setError(`You are paused, but ${incidentReference(held)} is still yours: ${errorMessage(failure)}`);
        }
        onUpdate(await api.me());
      }
      setAsking(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.resume());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const onClick = () => {
    if (paused) void resume();
    else if (held !== null) setAsking(true);
    else void pause(false);
  };

  return (
    <div className="availability">
      <OperatorStatusBadge status={operator.status} />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onClick}
        disabled={busy || operator.status === "OFFLINE"}
        aria-describedby={error ? "availability-error" : undefined}
      >
        <Icon name={paused ? "play" : "pause"} size="sm" />
        {paused ? "Resume" : "Pause"}
      </button>

      {error && !asking && (
        <div className="header-popover-error" id="availability-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setError(null)} aria-label="Dismiss">
            <Icon name="x" size="sm" />
          </button>
        </div>
      )}

      {asking && held !== null && isAdmin && (
        <PauseWithIncidentDialog
          reference={incidentReference(held)}
          busy={busy}
          error={error}
          onKeep={() => void pause(false)}
          onRelease={() => void pause(true)}
          onCancel={() => {
            setAsking(false);
            setError(null);
          }}
        />
      )}
      {asking && held !== null && !isAdmin && (
        <ConfirmDialog
          title="Pause new alerts?"
          icon="pause"
          confirmLabel="Pause"
          busyLabel="Pausing…"
          busy={busy}
          error={error}
          onConfirm={() => void pause(false)}
          onCancel={() => {
            setAsking(false);
            setError(null);
          }}
        >
          <p>
            You keep your current intervention on <strong>{incidentReference(held)}</strong> and can finish it as usual.
          </p>
          <p>While paused, you cannot accept new alerts. Resume when you are ready.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function PauseWithIncidentDialog({
  reference,
  busy,
  error,
  onKeep,
  onRelease,
  onCancel,
}: {
  reference: string;
  busy: boolean;
  error: string | null;
  onKeep: () => void;
  onRelease: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      title={`Pause while handling ${reference}?`}
      icon="pause"
      initialFocus={cancelRef}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRelease} disabled={busy}>
            Return it to the queue
          </button>
          <button type="button" className="btn btn-primary" onClick={onKeep} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Keep it and pause
          </button>
        </>
      }
    >
      <p>While paused you receive no new incidents. Choose what happens to {reference}:</p>
      <ul className="choice-list">
        <li>
          <strong>Keep it</strong> — it stays assigned to you and nobody else can change it. You can still finish it.
        </li>
        <li>
          <strong>Return it to the queue</strong> — the next available operator gets it straight away (or it waits for one). Your
          confirmation is cleared, so they decide for themselves.
        </li>
      </ul>
      {error && (
        <Notice tone="error" live="alert">
          {error}
        </Notice>
      )}
    </Modal>
  );
}
