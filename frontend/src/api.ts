import type {
  Alert,
  AlertStatus,
  Incident,
  Operator,
  Role,
  Service,
  Session,
  Statistics,
} from "./domain";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_BASE}. Check that the backend is running and VITE_API_BASE_URL is correct.`, 0);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string; detail?: string } | null;
    throw new ApiError(
      body?.message || body?.detail || `Request failed (${response.status})`,
      response.status,
      body?.error,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});

export const api = {
  login: (role: Role, username: string, password: string) =>
    request<Session>("/auth/login", undefined, json("POST", { role, username, password })),
  logout: (token: string) => request<void>("/auth/logout", token, json("POST")),
  me: (token: string) => request<Operator>("/operators/me", token),
  heartbeat: (token: string) => request<Operator>("/operators/heartbeat", token, json("POST")),
  setPaused: (token: string, paused: boolean) =>
    request<Operator>(`/operators/${paused ? "pause" : "resume"}`, token, json("POST")),
  incidents: (token: string) => request<Incident[]>("/incidents", token),
  incident: (token: string, id: number) => request<Incident>(`/incidents/${id}`, token),
  reviewIncident: (token: string, id: number) => request<Incident>(`/incidents/${id}/review`, token, json("POST")),
  saveDraft: (token: string, id: number, services: Service[]) =>
    request<Incident>(`/incidents/${id}/draft`, token, json("POST", { services })),
  sendAlert: (token: string, id: number, services: Service[]) =>
    request<Incident>(`/incidents/${id}/send`, token, json("POST", { services })),
  declineIncident: (token: string, id: number) =>
    request<Incident>(`/incidents/${id}/decline`, token, json("POST")),
  alerts: (token: string) => request<Alert[]>("/alerts", token),
  acceptAlert: (token: string, id: number) =>
    request<Alert>(`/alerts/${id}/accept`, token, json("POST")),
  updateAlert: (token: string, id: number, status: AlertStatus) =>
    request<Alert>(`/alerts/${id}/status`, token, json("POST", { status })),
  operators: (token: string) => request<Operator[]>("/operators", token),
  statistics: (token: string) => request<Statistics>("/statistics", token),
};
