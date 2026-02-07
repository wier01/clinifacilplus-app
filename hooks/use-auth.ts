// clinica-crm-mobile/hooks/use-auth.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthToken, clearAuthToken } from "@/lib/_core/api";
import { parseUserFromToken, isTokenExpired, type JwtUser } from "@/lib/_core/auth";

export function useAuth() {
  const [user, setUser] = useState<JwtUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }

      if (isTokenExpired(token)) {
        await clearAuthToken();
        setUser(null);
        return;
      }

      const u = parseUserFromToken(token);
      setUser(u);
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isAuthenticated = useMemo(() => !!user, [user]);

  const logout = useCallback(async () => {
    await clearAuthToken();
    setUser(null);
  }, []);

  return { user, loading, error, isAuthenticated, refresh, logout };
}
