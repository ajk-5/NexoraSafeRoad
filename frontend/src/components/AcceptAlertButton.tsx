import { useState } from "react";
import { useNavigate } from "react-router";

import { api, errorMessage } from "../services/api";
import { useAuth } from "../services/auth";

interface Props {
  alertId: number;
  incidentId: number;
  /** Called with the reason when accepting fails (e.g. another operator was faster). */
  onError: (message: string) => void;
}

/** Takes the intervention, then opens it. */
export function AcceptAlertButton({ alertId, incidentId, onError }: Props) {
  const { update } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await api.acceptAlert(alertId);
      update(await api.me()); // now BUSY with this intervention
      void navigate(`/operator/incidents/${incidentId}`);
    } catch (failure) {
      onError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <button type="button" className="button primary small" onClick={() => void accept()} disabled={busy}>
      {busy ? "Accepting…" : "Accept"}
    </button>
  );
}
