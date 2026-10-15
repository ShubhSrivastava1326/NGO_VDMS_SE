// Fetch wrapper implementing the conventions of the integration guide (section 2 and 4.1):
// bearer token, one error envelope, and "retry once anonymously" when a stored token has expired
// (public endpoints answer 401 INVALID_TOKEN to a bad token instead of serving the public data).

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;
const TOKEN_KEY = "vdms_token";

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked: session lasts until reload */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export interface ApiErrorBody {
  detail?: string;
  code?: string;
  errors?: { field: string | null; message: string }[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  errors: { field: string | null; message: string }[];

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.detail ?? (status === 0 ? "Cannot reach the server. Check your connection and try again." : `Request failed (${status})`));
    this.status = status;
    this.code = body?.code ?? (status === 0 ? "NETWORK_ERROR" : `HTTP_${status}`);
    this.errors = body?.errors ?? [];
  }

  /** { amount: "message", "donor.email": "message" } for inline form errors */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.errors) if (e.field) out[e.field] = e.message;
    return out;
  }
}

let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

type Params = Record<string, string | number | boolean | null | undefined>;

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Params;
  headers?: Record<string, string>;
  /** return the fetch Response (for PDF/CSV downloads) */
  raw?: boolean;
  signal?: AbortSignal;
}

const readJson = async (res: Response) => {
  try { return (await res.json()) as ApiErrorBody; } catch { return null; }
};

export async function api<T = unknown>(path: string, opts: ApiOptions = {}, retry = true): Promise<T> {
  const { method = "GET", body, params, headers = {}, raw = false, signal } = opts;
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const h: Record<string, string> = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (token) h.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, null);
  }

  if (!res.ok) {
    const err = new ApiError(res.status, await readJson(res));
    if (err.code === "INVALID_TOKEN" && token && retry) {
      tokenStore.clear();
      onSessionExpired();
      return api<T>(path, opts, false); // public pages keep working for an expired session
    }
    throw err;
  }
  if (raw) return res as T;
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Download a PDF/CSV that needs the Authorization header, then save it (guide section 8). */
export async function download(path: string, opts: ApiOptions = {}, fallbackName = "download") {
  const res = await api<Response>(path, { ...opts, raw: true });
  const blob = await res.blob();
  const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
