// clinica-crm-mobile/lib/_core/api.ts
import { kvGet, kvRemove, kvSet } from "@/lib/_core/storage";

const KEY_BASE_URL = "clinica_crm_api_base_url";
const KEY_AUTH_TOKEN = "clinica_crm_auth_token";

function env(name: string) {
  return (process.env as any)?.[name] as string | undefined;
}

const DEFAULT_BASE_URL = env("EXPO_PUBLIC_API_BASE_URL") || "http://localhost:3000";
const DEFAULT_DEV_TOKEN = env("EXPO_PUBLIC_DEV_TOKEN") || "";

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
};

export async function getApiBaseUrl(): Promise<string> {
  const saved = await kvGet(KEY_BASE_URL);
  let base = (saved || DEFAULT_BASE_URL || "").trim().replace(/\/+$/, "");

  // Web guard: avoid using the app's own origin (e.g. 8081) as API base.
  if (typeof window !== "undefined") {
    try {
      const origin = window.location.origin.replace(/\/+$/, "");
      const fallback = (DEFAULT_BASE_URL || "").trim().replace(/\/+$/, "");
      const looksLikeAppOrigin =
        base === origin ||
        base.includes("://localhost:8081") ||
        base.includes("://127.0.0.1:8081") ||
        base.includes("://localhost:19006") ||
        base.includes("localhost:8081") ||
        base.includes("127.0.0.1:8081") ||
        base.includes("localhost:19006");

      const hasScheme = /^https?:\/\//i.test(base);

      if (!base || !hasScheme || looksLikeAppOrigin) {
        await kvRemove(KEY_BASE_URL);
        base = fallback || base;
      } else if (base === origin && fallback && fallback !== origin) {
        base = fallback;
      }
    } catch {
      // ignore
    }
  }

  if (!base) {
    base = (DEFAULT_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
  }

  return base;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const u = (url || "").trim().replace(/\/+$/, "");
  if (!u) return;
  await kvSet(KEY_BASE_URL, u);
}

export async function clearApiBaseUrl(): Promise<void> {
  await kvRemove(KEY_BASE_URL);
}

export async function getAuthToken(): Promise<string | null> {
  const saved = await kvGet(KEY_AUTH_TOKEN);
  if (saved && saved.trim()) return saved.trim();
  // fallback dev token (web/dev only)
  if (DEFAULT_DEV_TOKEN && DEFAULT_DEV_TOKEN.trim()) return DEFAULT_DEV_TOKEN.trim();
  return null;
}

export async function setAuthToken(token: string): Promise<void> {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return;
  await kvSet(KEY_AUTH_TOKEN, t);
}

export async function clearAuthToken(): Promise<void> {
  await kvRemove(KEY_AUTH_TOKEN);
}

export async function apiCall<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const url = path.startsWith("http")
    ? path
    : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  };

  const token = await getAuthToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error))
        ? `${data.error || "ERROR"}: ${data.message || ""}`.trim()
        : String(text || res.statusText);

    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}
