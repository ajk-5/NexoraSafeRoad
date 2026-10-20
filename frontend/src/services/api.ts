import type {
  AIModel,
  Alert,
  AlertStatus,
  AlertUpdate,
  Incident,
  IncidentStatus,
  LoginResponse,
  Operator,
  Role,
  ServiceStations,
  ServiceType,
  StationChoice,
  Statistics,
  TrainingDataset,
  TrainingJob,
  TrainingJobRequest,
  TrainingOverview,
} from "../types/api";

/** An error response from the backend: {"error": "CODE", "message": "..."}. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = "saferoad.token";

// Kept per browser tab: the backend allows one session per operator anyway.
let token: string | null = readToken();
let onUnauthorized: () => void = () => {};

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return token !== null;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

/** Called when the backend rejects the session (signed out, or signed in elsewhere). */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function isErrorBody(body: unknown): body is { error: string; message: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).error === "string" &&
    typeof (body as Record<string, unknown>).message === "string"
  );
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection.");
  }

  if (!response.ok) throw failure(response.status, await response.json().catch(() => null), path);
  // The backend's JSON matches the types in types/api.ts (see backend/schemas).
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** The error for a failed response; signs out when the session was rejected. */
function failure(status: number, body: unknown, path: string): ApiError {
  if (status === 401 && token !== null && path !== "/auth/login") {
    setToken(null);
    onUnauthorized();
  }
  if (isErrorBody(body)) return new ApiError(status, body.error, body.message);
  return new ApiError(status, `HTTP_${status}`, "Something went wrong. Please try again.");
}

/** Upload a dataset zip. Uses XMLHttpRequest because fetch cannot report upload progress. */
function uploadDataset(name: string, file: File, onProgress: (fraction: number) => void): Promise<TrainingDataset> {
  const path = `/training/datasets${query({ name })}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    if (token !== null) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/zip");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON: reported as a generic error below
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as TrainingDataset);
      else reject(failure(xhr.status, body, path));
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection."));
    xhr.send(file);
  });
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export const api = {
  login: (role: Role, username: string, password: string) =>
    request<LoginResponse>("POST", "/auth/login", { role, username, password }),
  logout: () => request<void>("POST", "/auth/logout"),

  me: () => request<Operator>("GET", "/operators/me"),
  operators: () => request<Operator[]>("GET", "/operators"),
  pause: () => request<Operator>("POST", "/operators/pause"),
  resume: () => request<Operator>("POST", "/operators/resume"),
  heartbeat: () => request<Operator>("POST", "/operators/heartbeat"),

  incidents: (status?: IncidentStatus) => request<Incident[]>("GET", `/incidents${query({ status })}`),
  incident: (id: number) => request<Incident>("GET", `/incidents/${id}`),
  incidentStations: (id: number) => request<ServiceStations[]>("GET", `/incidents/${id}/stations`),
  startReview: (id: number) => request<Incident>("POST", `/incidents/${id}/review`),
  saveDraft: (id: number, services: ServiceType[], stations: StationChoice) =>
    request<Incident>("POST", `/incidents/${id}/draft`, { services, stations }),
  sendAlert: (id: number, services: ServiceType[], stations: StationChoice) =>
    request<Incident>("POST", `/incidents/${id}/send`, { services, stations }),
  decline: (id: number) => request<Incident>("POST", `/incidents/${id}/decline`),

  alerts: (status?: AlertStatus) => request<Alert[]>("GET", `/alerts${query({ status })}`),
  alert: (id: number) => request<Alert>("GET", `/alerts/${id}`),
  acceptAlert: (id: number) => request<Alert>("POST", `/alerts/${id}/accept`),
  updateAlert: (id: number, status: AlertUpdate) => request<Alert>("POST", `/alerts/${id}/status`, { status }),

  statistics: () => request<Statistics>("GET", "/statistics"),

  training: {
    overview: () => request<TrainingOverview>("GET", "/training/overview"),
    models: () => request<AIModel[]>("GET", "/training/models"),
    activateModel: (id: number) => request<AIModel>("POST", `/training/models/${id}/activate`),
    datasets: () => request<TrainingDataset[]>("GET", "/training/datasets"),
    uploadDataset,
    jobs: () => request<TrainingJob[]>("GET", "/training/jobs"),
    job: (id: number) => request<TrainingJob>("GET", `/training/jobs/${id}`),
    createJob: (job: TrainingJobRequest) => request<TrainingJob>("POST", "/training/jobs", job),
    cancelJob: (id: number) => request<TrainingJob>("POST", `/training/jobs/${id}/cancel`),
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
