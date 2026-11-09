import { useState } from "react";

import { formatMetric } from "../format";
import { api, errorMessage } from "../services/api";
import { activationWarning } from "../training";
import type { AIModel } from "../types/api";
import { ConfirmDialog } from "./Dialog";
import { Notice } from "./ui";

/** Asks before switching the accident detector to another model, warning when it scored lower. */
export function ActivateModelDialog({ model, active, onDone, onCancel }: { model: AIModel; active: AIModel | undefined; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warning = activationWarning(model, active);

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.training.activateModel(model.id);
      onDone();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={`Use “${model.name}” for detection?`}
      icon="cpu"
      confirmLabel="Use this model"
      busyLabel="Switching…"
      busy={busy}
      error={error}
      onConfirm={() => void activate()}
      onCancel={onCancel}
    >
      {warning && (
        <Notice tone="warning" title="Lower score than the active model">
          {warning}
        </Notice>
      )}
      <dl className="summary-list">
        <dt>mAP50</dt>
        <dd>{formatMetric(model.map50)}</dd>
        <dt>Recall</dt>
        <dd>{formatMetric(model.recall)}</dd>
        <dt>Replaces</dt>
        <dd>{active?.name ?? "No active model"}</dd>
      </dl>
      <p>The detector loads the active model when it next starts. Incidents already reported are not changed.</p>
    </ConfirmDialog>
  );
}
