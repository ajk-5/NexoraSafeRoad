import { useState } from "react";

import { incidentReference } from "../../format";
import { ROLE_LABELS } from "../../labels";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "../../services/theme";
import type { Operator } from "../../types/api";
import { ConfirmDialog } from "../Dialog";
import { Icon, type IconName } from "../Icon";
import { usePopover } from "./usePopover";

const THEMES: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function AccountMenu({ operator, onSignOut }: { operator: Operator; onSignOut: () => Promise<void> }) {
  const { open, toggle, rootRef, buttonRef } = usePopover();
  const theme = useThemeChoice();
  const [signingOut, setSigningOut] = useState(false);
  const [asking, setAsking] = useState(false);
  const held = operator.currentIncidentId;

  const signOut = () => {
    setSigningOut(true);
    void onSignOut().finally(() => setSigningOut(false));
  };

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="account-button"
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={toggle}
      >
        <span className="avatar" aria-hidden="true">
          {initials(operator.displayName)}
        </span>
        <span className="account-text">
          <span className="account-name">{operator.displayName}</span>
          <span className="account-role">{ROLE_LABELS[operator.role]}</span>
        </span>
        <Icon name="chevronDown" size="sm" className="account-chevron" />
        <span className="visually-hidden">Account menu</span>
      </button>
      {open && (
        <div className="menu-panel account-panel" id="account-panel" role="region" aria-label="Account">
          <div className="menu-heading">
            <div className="strong">{operator.displayName}</div>
            <div className="small muted">
              {ROLE_LABELS[operator.role]} · {operator.username}
            </div>
          </div>
          <div className="menu-sep" />
          <div className="menu-heading section-title" id="theme-label">
            Appearance
          </div>
          <div className="segmented block theme-switch" role="group" aria-labelledby="theme-label">
            {THEMES.map((option) => (
              <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => setThemeChoice(option.value)}>
                <Icon name={option.icon} size="sm" />
                {option.label}
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <button
            type="button"
            className="menu-item"
            disabled={signingOut}
            onClick={() => (held === null ? signOut() : setAsking(true))}
          >
            <Icon name="logout" size="sm" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
      {asking && held !== null && (
        <ConfirmDialog
          title="Sign out?"
          icon="logout"
          confirmLabel="Sign out"
          busyLabel="Signing out…"
          busy={signingOut}
          onConfirm={signOut}
          onCancel={() => setAsking(false)}
        >
          {operator.role === "ADMIN" ? (
            <p>
              <strong>{incidentReference(held)}</strong> goes back to the queue and the next available admin gets it. Your
              confirmation of it is not kept.
            </p>
          ) : (
            <p>
              Your intervention on <strong>{incidentReference(held)}</strong> stays assigned to you. Sign in again to finish it.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
