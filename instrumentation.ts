import { isDuplicateTraceEnabled, logTrace } from "@/lib/debugLog";

const STARTUP_TRACE_GUARD = "__dupTraceStartupLogged";

declare global {
  // eslint-disable-next-line no-var
  var __dupTraceStartupLogged: boolean | undefined;
}

function getConvexHost(value?: string) {
  if (!value) return "unset";

  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

export async function register() {
  if (globalThis[STARTUP_TRACE_GUARD]) {
    return;
  }
  globalThis[STARTUP_TRACE_GUARD] = true;

  const startupPayload = {
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    runtime: "nodejs",
    startedAt: new Date().toISOString(),
    port: process.env.PORT ?? "unset",
    convexUrlHost: getConvexHost(process.env.NEXT_PUBLIC_CONVEX_URL),
    debugDuplicateTraceEnabled: process.env.DEBUG_DUPLICATE_ASSET_TRACE === "1",
    nextPublicDebugDuplicateTraceEnabled: process.env.NEXT_PUBLIC_DEBUG_DUPLICATE_ASSET_TRACE === "1",
    muxWebhookSecretPresent: Boolean(process.env.MUX_WEBHOOK_SECRET),
    nextPublicStreamProvider: process.env.NEXT_PUBLIC_STREAM_PROVIDER ?? "unset",
  };

  // Always emit once in local/dev so startup is visibly confirmed.
  if (process.env.NODE_ENV !== "production") {
    console.log("[startup-check]", JSON.stringify(startupPayload));
  }

  if (isDuplicateTraceEnabled()) {
    logTrace("next-server", "next-server-startup", startupPayload);
  }
}
