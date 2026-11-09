import { afterEach, expect, it, vi } from "vitest";
import { api, sessionToken, setToken, setUnauthorizedHandler } from "./api";

afterEach(() => { setToken(null); setUnauthorizedHandler(() => {}); vi.unstubAllGlobals(); });

it("ignores a stale 401 from the token replaced by a password change", async () => {
  let answer!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; })));
  const unauthorized = vi.fn();
  setUnauthorizedHandler(unauthorized);
  setToken("old-token");
  const pending = api.me().catch((error: unknown) => error);
  setToken("new-token");
  answer(new Response(JSON.stringify({ error: "NOT_AUTHENTICATED", message: "Sign in" }), { status: 401 }));
  await pending;
  expect(sessionToken()).toBe("new-token");
  expect(unauthorized).not.toHaveBeenCalled();
});
