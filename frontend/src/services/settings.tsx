import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface AppSettings {
  desktopNotifications: boolean;
  sound: boolean;
  volume: number;
  repeat: boolean;
}
export const DEFAULT_SETTINGS: AppSettings = { desktopNotifications: false, sound: true, volume: 0.8, repeat: true };

export function readSettings(key: string): AppSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<AppSettings> | null;
    return {
      desktopNotifications: typeof value?.desktopNotifications === "boolean" ? value.desktopNotifications : DEFAULT_SETTINGS.desktopNotifications,
      sound: typeof value?.sound === "boolean" ? value.sound : DEFAULT_SETTINGS.sound,
      repeat: typeof value?.repeat === "boolean" ? value.repeat : DEFAULT_SETTINGS.repeat,
      volume: typeof value?.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume)) : DEFAULT_SETTINGS.volume,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

const SettingsContext = createContext<{
  settings: AppSettings;
  save: (patch: Partial<AppSettings>) => void;
} | null>(null);

export function SettingsProvider({ operatorId, children }: { operatorId: number; children: ReactNode }) {
  const key = `saferoad.settings.${operatorId}`;
  const [settings, setSettings] = useState(() => readSettings(key));
  const save = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep session preferences without storage. */ }
      return next;
    });
  }, [key]);
  return <SettingsContext.Provider value={{ settings, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("SettingsProvider is required");
  return value;
}
