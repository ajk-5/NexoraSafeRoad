import { afterEach, expect, it, vi } from "vitest";
import { connectLive } from "./socket";

class Socket {
  static instances: Socket[] = [];
  onopen = () => {};
  onmessage = (_event: { data: string }) => {};
  onclose = (_event: { code: number }) => {};
  onerror = () => {};
  send = vi.fn();
  close = vi.fn(() => this.onclose({ code: 1000 }));
  constructor(public url: URL) { Socket.instances.push(this); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Socket.instances = []; });

it("authenticates in a frame, refreshes on changes, reconnects and cleans up", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const changed = vi.fn();
  const status = vi.fn();
  const stop = connectLive("secret-session", changed, status);
  const first = Socket.instances[0]!;
  expect(String(first.url)).not.toContain("secret-session");
  first.onopen();
  expect(first.send).toHaveBeenCalledWith(JSON.stringify({ token: "secret-session" }));
  first.onmessage({ data: '{"type":"changed"}' });
  first.onmessage({ data: '{"type":"ping"}' });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(status).toHaveBeenCalledWith(true);
  first.onclose({ code: 1006 });
  expect(status).toHaveBeenLastCalledWith(false);
  vi.advanceTimersByTime(1_000);
  expect(Socket.instances).toHaveLength(2);
  stop();
  vi.advanceTimersByTime(60_000);
  expect(Socket.instances).toHaveLength(2);
});

it("does not retry revoked sessions", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const changed = vi.fn();
  const stop = connectLive("revoked", changed, vi.fn());
  Socket.instances[0]!.onclose({ code: 1008 });
  vi.advanceTimersByTime(60_000);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(Socket.instances).toHaveLength(1);
  stop();
});
