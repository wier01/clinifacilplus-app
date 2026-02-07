import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl as getApiBaseUrlFromEnv } from "@/constants/oauth";
import { getAuthToken } from "@/lib/_core/api";

/**
 * NOTE:
 * This project template included a cookie-based OAuth flow.
 * For Clínica CRM we use JWT token stored on the client.
 *
 * tRPC is kept for template compatibility, but the CRM screens use REST endpoints.
 */
export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  const base = getApiBaseUrlFromEnv();
  const url = base ? `${base}/api/trpc` : "/api/trpc";

  return trpc.createClient({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        async headers() {
          const token = await getAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
