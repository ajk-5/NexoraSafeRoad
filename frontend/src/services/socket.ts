/** Reconnect with bounded backoff; REST polling remains available during outages. */
export function connectLive(token: string, changed: () => void, status: (connected: boolean) => void): () => void {
  let stopped = false;
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let delay = 1_000;
  const connect = () => {
    if (stopped) return;
    const url = new URL("/api/live", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    try {
      socket = new WebSocket(url);
    } catch {
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30_000);
      return;
    }
    const current = socket;
    const keepAlive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => current.close(), 15_000);
    };
    current.onopen = () => {
      current.send(JSON.stringify({ token }));
      keepAlive();
    };
    current.onmessage = (event) => {
      if (stopped) return;
      try {
        const message = JSON.parse(String(event.data)) as { type?: string };
        if (message.type !== "changed" && message.type !== "ping") return;
        keepAlive();
        delay = 1_000;
        status(true);
        if (message.type === "changed") changed();
      } catch { /* Ignore malformed frames; the watchdog reconnects a silent socket. */ }
    };
    current.onerror = () => current.close();
    current.onclose = (event) => {
      clearTimeout(watchdog);
      if (stopped) return;
      status(false);
      if (event.code === 1008) { changed(); return; }
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30_000);
    };
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(watchdog);
    socket?.close();
  };
}
