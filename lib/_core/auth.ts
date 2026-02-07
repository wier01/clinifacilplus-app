// clinica-crm-mobile/lib/_core/auth.ts
/**
 * CRM auth is JWT-based (token stored in client).
 * Token payload expected:
 * {
 *   sub: string,
 *   role: "SUPERADMIN" | "ADMIN" | "SECRETARIA" | "MEDICO",
 *   name: string,
 *   email: string,
 *   clinic_id: string,
 *   iat?: number,
 *   exp?: number
 * }
 */

export type UserRole = "SUPERADMIN" | "ADMIN" | "SECRETARIA" | "MEDICO";

export type JwtUser = {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
  clinic_id: string;
  iat?: number;
  exp?: number;
};

function base64UrlDecode(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const raw = window.atob(base64);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  // Node fallback (shouldn't happen on Expo Web)
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function parseUserFromToken(token: string): JwtUser | null {
  try {
    const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload || typeof payload !== "object") return null;

    const sub = String(payload.sub || "");
    const role = payload.role as UserRole;
    const name = String(payload.name || "");
    const email = String(payload.email || "");
    const clinic_id = String(payload.clinic_id || "");

    if (!sub || !role || !name || !email || !clinic_id) return null;

    return {
      sub,
      role,
      name,
      email,
      clinic_id,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const u = parseUserFromToken(token);
  if (!u?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= (u.exp - skewSeconds);
}
