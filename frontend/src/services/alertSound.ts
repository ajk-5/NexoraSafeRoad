let context: AudioContext | undefined;
const playing = new Set<OscillatorNode>();

export function soundReady(): boolean {
  return context?.state === "running";
}

/** Call from a user gesture so browser autoplay policies can authorize sound. */
export async function enableSound(): Promise<boolean> {
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    if (context.state !== "running") await context.resume();
    return soundReady();
  } catch { return false; }
}

export function stopSound(): void {
  for (const oscillator of playing) {
    try { oscillator.stop(); } catch { /* Already ended. */ }
  }
  playing.clear();
}

/** Three distinct alternating high/low bursts, with a short envelope to avoid clicks. */
export function playAlertSound(volume: number): boolean {
  if (!context || !soundReady()) return false;
  stopSound();
  const level = Math.max(0, Math.min(1, volume));
  if (level === 0) return true;
  for (let i = 0; i < 6; i += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + i * 0.24;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(i % 2 === 0 ? 880 : 1320, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level * 0.16, start + 0.015);
    gain.gain.setValueAtTime(level * 0.16, start + 0.16);
    gain.gain.linearRampToValueAtTime(0, start + 0.21);
    oscillator.connect(gain);
    gain.connect(context.destination);
    playing.add(oscillator);
    oscillator.onended = () => { playing.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + 0.22);
  }
  return true;
}
