import { useState } from "react";

import { Card } from "../components/ui";
import { ChangePassword } from "../components/ChangePassword";
import { enableSound, playAlertSound } from "../services/alertSound";
import { useLive } from "../services/live";
import { DEFAULT_SETTINGS, useSettings } from "../services/settings";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "../services/theme";

export function Settings() {
  const { settings, save } = useSettings();
  const theme = useThemeChoice();
  const { connected } = useLive();
  const [message, setMessage] = useState("");
  return (
    <div className="stack settings-page">
      <ChangePassword />
      <Card title="Alert notifications">
        <div className="stack">
          <p className="small muted">Preferences are saved for your account in this browser.</p>
          <label className="check"><input type="checkbox" checked={settings.sound} onChange={(event) => save({ sound: event.target.checked })} />Play an attention-grabbing sound for incoming alerts</label>
          <label className="field" htmlFor="alert-volume">
            <span className="field-label">Alert volume: {Math.round(settings.volume * 100)}%</span>
            <input id="alert-volume" type="range" min="0" max="100" value={Math.round(settings.volume * 100)} onChange={(event) => save({ volume: Number(event.target.value) / 100 })} />
          </label>
          <label className="check"><input type="checkbox" checked={settings.repeat} onChange={(event) => save({ repeat: event.target.checked })} />Repeat every 8 seconds until silenced, reviewed or accepted</label>
          <p className="muted small">New incidents assigned to admins and new alerts for your emergency service trigger the sound. Keep the app open; suspended browsers and sleeping devices cannot guarantee playback.</p>
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
