import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { workspacePath } from "../paths";
import { enableSound, playAlertSound, soundReady, stopSound } from "../services/alertSound";
import { useLive } from "../services/live";
import { useSettings } from "../services/settings";
import { useDesktopAlerts } from "../services/desktopNotifications";
import type { Operator } from "../types/api";

export function AlertAttention({ operator }: { operator: Operator }) {
  const { incidents, alerts } = useLive();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const open = useCallback((path: string) => { void navigate(path); }, [navigate]);
  const [ready, setReady] = useState(soundReady);
  const [silenced, setSilenced] = useState<Set<string>>(() => new Set());
  const pending = useMemo(() => operator.role === "ADMIN"
    ? (incidents.data ?? []).filter((i) => i.canEdit && i.status === "ASSIGNED").map((i) => ({ key: `incident-${i.id}`, id: i.id, reference: i.reference, severity: i.severity }))
    : operator.role === "SUPERADMIN" ? []
    : (alerts.data ?? []).filter((a) => a.status === "SENT" && a.canAccept).map((a) => ({ key: `alert-${a.id}`, id: a.incidentId, reference: a.incidentReference, severity: a.severity })),
    [operator.role, incidents.data, alerts.data]);
  // The dashboard can automatically start a review before its shared queue reloads.
  // Include that assigned work so background assignments still produce a desktop alert.
  const desktopPending = useMemo(() => operator.role === "ADMIN"
    ? (incidents.data ?? []).filter((item) => item.canEdit && (item.status === "ASSIGNED" || item.status === "UNDER_REVIEW"))
      .map((item) => ({ key: `incident-${item.id}`, id: item.id, reference: item.reference, severity: item.severity }))
    : pending, [operator.role, incidents.data, pending]);
  const desktopAlerts = useMemo(() => desktopPending.map((item) => ({
    key: `${operator.id}-${item.key}`,
    title: operator.role === "ADMIN" ? "SafeRoad — Incident assigned to you" : "SafeRoad — New emergency alert",
    body: `${item.reference} · ${item.severity.toLowerCase()} severity. Open SafeRoad to respond.`,
    path: workspacePath(operator.role, item.id),
  })), [desktopPending, operator.id, operator.role]);
  useDesktopAlerts(operator.id, settings.desktopNotifications, desktopAlerts, open);
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
