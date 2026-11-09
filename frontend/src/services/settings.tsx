import { createContext, useContext, useState, type ReactNode } from "react";

export interface AppSettings {
  sound: boolean;
  volume: number;
  repeat: boolean;
}
export const DEFAULT_SETTINGS: AppSettings = { sound: true, volume: 0.8, repeat: true };

export function readSettings(key: string): AppSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<AppSettings> | null;
    return {
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
  const save = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep session preferences without storage. */ }
    setSettings(next);
  };
  return <SettingsContext.Provider value={{ settings, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("SettingsProvider is required");
  return value;
}
