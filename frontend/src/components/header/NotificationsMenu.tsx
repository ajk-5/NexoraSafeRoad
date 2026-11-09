import { Link } from "react-router";

import { incidentTitle } from "../../domain/incidents";
import { incidentReference, locationLabel, timeAgo } from "../../format";
import { SEVERITY_LABELS } from "../../labels";
import { homePath, workspacePath } from "../../paths";
import { useLive } from "../../services/live";
import type { Operator } from "../../types/api";
import { Icon } from "../Icon";
import { usePopover } from "./usePopover";

interface Item {
  key: string;
  to: string;
  title: string;
  detail: string;
  urgent?: boolean;
}

/** What needs attention, from the same live data as the rest of the console (nothing made up). */
function useNotifications(operator: Operator): { items: Item[]; count: number; empty: string } {
  const { incidents, alerts } = useLive();
  const now = Date.now();

  if (operator.role === "ADMIN") {
    const all = incidents.data ?? [];
    const waiting = all.filter((i) => i.status === "WAITING_FOR_OPERATOR" || i.status === "DETECTED");
    const mine = operator.currentIncidentId === null ? undefined : all.find((i) => i.id === operator.currentIncidentId);
    const items: Item[] = [];
    if (operator.currentIncidentId !== null) {
      items.push({
        key: "mine",
        to: workspacePath(operator.role, operator.currentIncidentId),
        title: `${incidentReference(operator.currentIncidentId)} is assigned to you`,
        detail: mine ? `${incidentTitle(mine)} · ${locationLabel(mine)}` : "Open it to review",
        urgent: true,
      });
    }
    if (waiting.length > 0) {
      items.push({
        key: "waiting",
        to: `${homePath(operator.role)}?filter=waiting`,
        title: `${waiting.length} incident${waiting.length === 1 ? "" : "s"} waiting for an operator`,
        detail:
          operator.status === "PAUSED"
            ? "You are paused. Resume to receive incidents."
            : "They are assigned automatically to the next available operator.",
      });
    }
    const unopenedMine = mine?.status === "ASSIGNED" ? 1 : 0;
    return { items, count: waiting.length + unopenedMine, empty: "Nothing needs your attention." };
  }

  const fresh = (alerts.data ?? []).filter((a) => a.status === "SENT");
  const current = (alerts.data ?? []).find((a) => a.canUpdate);
  const items: Item[] = [];
  if (current) {
    items.push({
      key: "current",
      to: workspacePath(operator.role, current.incidentId),
      title: `Your intervention: ${current.incidentReference}`,
      detail: locationLabel(current),
    });
  }
  for (const alert of fresh.slice(0, 5)) {
    items.push({
      key: `alert-${alert.id}`,
      to: workspacePath(operator.role, alert.incidentId),
      title: `New alert ${alert.incidentReference} · ${SEVERITY_LABELS[alert.severity]} severity`,
      detail: `${locationLabel(alert)} · ${timeAgo(alert.sentAt, now)}`,
      urgent: alert.severity === "HIGH",
    });
  }
  return { items, count: fresh.length, empty: "No new alerts for your service." };
}

export function NotificationsMenu({ operator }: { operator: Operator }) {
  const { open, toggle, close, rootRef, buttonRef } = usePopover();
  const { items, count, empty } = useNotifications(operator);
  const label = count === 0 ? "Notifications" : `Notifications, ${count} need${count === 1 ? "s" : ""} attention`;

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost btn-icon header-icon-button"
        aria-expanded={open}
        aria-controls="notifications-panel"
        aria-label={label}
        title="Notifications"
        onClick={toggle}
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className="count-pill header-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="menu-panel" id="notifications-panel" role="region" aria-label="Notifications">
          <div className="menu-heading section-title">Needs attention</div>
          {items.length === 0 ? (
            <div className="menu-empty">{empty}</div>
          ) : (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className={`menu-item notification${item.urgent ? " urgent" : ""}`} onClick={close}>
                    <Icon name={item.urgent ? "alert" : "info"} size="sm" />
                    <span>
                      <span className="notification-title">{item.title}</span>
                      <span className="notification-detail">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
