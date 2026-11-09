import { useConnection } from "../../services/connection";
import { useNow } from "../../services/useNow";
import { Icon } from "../Icon";

/** Data older than this is called out, even without an error (e.g. the tab was asleep). */
const STALE_MS = 30_000;

/**
 * Tells the operator whether what they see is live. The announced text only changes with the
 * state (live / outdated / lost); the exact age is in the tooltip.
 */
export function ConnectionStatus() {
  const { lastOk, failing } = useConnection();
  const now = useNow(5_000);
  const age = lastOk === null ? null : now - lastOk;

  let tone: "ok" | "stale" | "lost" | "pending";
  let label: string;
  if (failing) {
    tone = "lost";
    label = "Connection lost — data may be outdated";
  } else if (lastOk === null) {
    tone = "pending";
    label = "Connecting…";
  } else if (age !== null && age > STALE_MS) {
    tone = "stale";
    label = "Data may be outdated";
  } else {
    tone = "ok";
    label = "Live";
  }
  const detail = lastOk === null ? "No data received yet" : `Last update ${Math.max(0, Math.round((age ?? 0) / 1000))} s ago`;

  return (
    <div className={`connection connection-${tone}`} title={detail} role="status">
      {tone === "lost" ? <Icon name="wifiOff" size="sm" /> : <span className="connection-dot" aria-hidden="true" />}
      <span className="connection-label">{label}</span>
    </div>
  );
}
