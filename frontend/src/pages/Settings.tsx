import { useState } from "react";

import { Card } from "../components/ui";
import { ChangePassword } from "../components/ChangePassword";
import { enableSound, playAlertSound } from "../services/alertSound";
import { useLive } from "../services/live";
import { DEFAULT_SETTINGS, useSettings } from "../services/settings";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "../services/theme";
import { requestDesktopPermission, showDesktopNotification, useDesktopPermission } from "../services/desktopNotifications";
import { useOperator } from "../services/auth";
import { homePath } from "../paths";
import { useNavigate } from "react-router";

export function Settings() {
  const { settings, save } = useSettings();
  const theme = useThemeChoice();
  const { connected } = useLive();
  const [message, setMessage] = useState("");
  const permission = useDesktopPermission();
  const operator = useOperator();
  const navigate = useNavigate();
  const [enabling, setEnabling] = useState(false);
  const desktopUnavailable = permission === "unsupported" || permission === "insecure" || permission === "denied";
  const enableDesktop = async () => {
    setEnabling(true);
    const result = await requestDesktopPermission();
    save({ desktopNotifications: result === "granted" });
    setMessage(result === "granted" ? "Desktop notifications enabled on this computer." : "Desktop notifications were not enabled. Allow notifications in your browser's site settings.");
    setEnabling(false);
  };
  return (
    <div className="stack settings-page">
      <ChangePassword />
      <Card title="Alert notifications">
        <div className="stack">
          <p className="small muted">Preferences are saved for your account in this browser.</p>
          <label className="check"><input type="checkbox" checked={settings.desktopNotifications} disabled={enabling || (!settings.desktopNotifications && desktopUnavailable)} onChange={(event) => {
            if (!event.target.checked) save({ desktopNotifications: false });
            else void enableDesktop();
          }} />Show desktop notifications on this computer</label>
          <p className="field-hint" role="status">
            {permission === "unsupported" ? "This browser does not support desktop notifications. Use a current desktop browser such as Edge, Chrome or Firefox."
              : permission === "insecure" ? "Desktop notifications require HTTPS or localhost."
              : permission === "denied" ? "Notifications are blocked. Allow them in your browser's site settings, then return here."
              : "Allow notifications when your browser asks. Incoming alerts can appear while you use another app."}
          </p>
          <div className="settings-actions">
            <button className="btn btn-secondary" type="button" disabled={enabling || desktopUnavailable} onClick={() => void enableDesktop()}>{enabling ? "Enabling…" : "Enable desktop notifications"}</button>
            <button className="btn btn-secondary" type="button" disabled={!settings.desktopNotifications || permission !== "granted"} onClick={() => {
              const shown = showDesktopNotification({ key: "test", title: "SafeRoad — Desktop notifications ready", body: "Incoming alerts will appear here. Click to open your dashboard.", path: homePath(operator.role) }, (path) => { void navigate(path); });
              setMessage(shown ? "Test notification sent. If it does not appear, check your computer's notification and Do Not Disturb settings." : "The browser could not show a desktop notification.");
            }}>Test desktop notification</button>
          </div>
          <p className="muted small">Keep SafeRoad open in a browser tab. Desktop alerts work in the background while the browser is running; closed or suspended tabs and sleeping computers cannot receive live alerts.</p>
          <label className="check"><input type="checkbox" checked={settings.sound} onChange={(event) => save({ sound: event.target.checked })} />Play an attention-grabbing sound for incoming alerts</label>
          <label className="field" htmlFor="alert-volume">
            <span className="field-label">Alert volume: {Math.round(settings.volume * 100)}%</span>
            <input id="alert-volume" type="range" min="0" max="100" value={Math.round(settings.volume * 100)} onChange={(event) => save({ volume: Number(event.target.value) / 100 })} />
          </label>
          <label className="check"><input type="checkbox" checked={settings.repeat} onChange={(event) => save({ repeat: event.target.checked })} />Repeat every 8 seconds until silenced, reviewed or accepted</label>
          <p className="muted small">New incidents assigned to operators and new alerts for your emergency service trigger the sound. Keep the app open; suspended browsers and sleeping devices cannot guarantee playback.</p>
          <div className="settings-actions">
            <button className="btn btn-primary" type="button" onClick={() => {
              void enableSound().then((ready) => {
                const played = ready && playAlertSound(settings.volume);
                setMessage(played ? "Test sound played. Check your device volume if you cannot hear it." : "Sound is unavailable. Allow audio in your browser and try again.");
              });
            }}>Test alert sound</button>
            <button className="btn btn-secondary" type="button" onClick={() => { save(DEFAULT_SETTINGS); setThemeChoice("light"); setMessage("Default settings restored."); }}>Restore defaults</button>
          </div>
          <p role="status" className="small muted">{message}</p>
        </div>
      </Card>
      <Card title="Appearance">
        <label className="field" htmlFor="app-theme"><span className="field-label">Theme</span>
          <select className="select" id="app-theme" value={theme} onChange={(event) => setThemeChoice(event.target.value as ThemeChoice)}>
            <option value="light">Light</option><option value="dark">Dark</option><option value="system">Follow system</option>
          </select>
        </label>
      </Card>
      <Card title="Live connection">
        <p role="status">{connected ? "WebSocket connected. Alerts refresh automatically when work changes." : "WebSocket reconnecting. The app also checks for changes every 5 seconds while visible."}</p>
      </Card>
    </div>
  );
}
