import { useEffect, useState } from "react";
import { Link } from "react-router";

import { workspacePath } from "../paths";
import { enableSound, playAlertSound, soundReady, stopSound } from "../services/alertSound";
import { useLive } from "../services/live";
import { useSettings } from "../services/settings";
import type { Operator } from "../types/api";

export function AlertAttention({ operator }: { operator: Operator }) {
  const { incidents, alerts } = useLive();
  const { settings } = useSettings();
  const [ready, setReady] = useState(soundReady);
  const [silenced, setSilenced] = useState<Set<string>>(() => new Set());
  const pending = operator.role === "ADMIN"
    ? (incidents.data ?? []).filter((i) => i.canEdit && i.status === "ASSIGNED").map((i) => ({ key: `incident-${i.id}`, id: i.id }))
    : operator.role === "SUPERADMIN" ? []
    : (alerts.data ?? []).filter((a) => a.status === "SENT" && a.canAccept).map((a) => ({ key: `alert-${a.id}`, id: a.incidentId }));
  const audible = pending.filter((item) => !silenced.has(item.key));
  const signature = audible.map((item) => item.key).sort().join(",");

  useEffect(() => {
    const unlock = () => { void enableSound().then(setReady); };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!settings.sound || !signature || !ready) return;
    const play = () => { if (!playAlertSound(settings.volume)) setReady(false); };
    play();
    const timer = settings.repeat ? setInterval(play, 8_000) : undefined;
    return () => { clearInterval(timer); stopSound(); };
  }, [signature, ready, settings.sound, settings.volume, settings.repeat]);

  if (operator.role === "SUPERADMIN") return null;
  return (
    <>
      {settings.sound && !ready && (
        <div className="sound-banner" role="status">
          <span>Enable sound to hear incoming emergency alerts. Keep this app open.</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void enableSound().then(setReady)}>Enable alert sound</button>
        </div>
      )}
      {audible.length > 0 && (
        <div className="attention-banner" role="alert">
          <strong>{audible.length} {operator.role === "ADMIN" ? "incident assigned to you" : "new emergency alert(s)"}</strong>
          <Link className="btn btn-secondary btn-sm" to={workspacePath(operator.role, audible[0]!.id)}>Open alert</Link>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => {
            stopSound();
            setSilenced((previous) => new Set([...previous, ...pending.map((item) => item.key)]));
          }}>Silence these alerts</button>
        </div>
      )}
    </>
  );
}
