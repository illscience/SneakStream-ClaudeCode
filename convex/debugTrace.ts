type TracePayload = Record<string, unknown>;

const DUPLICATE_TRACE_FLAG = "1";

function isTraceEnabled() {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }
  return process.env.DEBUG_DUPLICATE_ASSET_TRACE === DUPLICATE_TRACE_FLAG;
}

export function logConvexTrace(event: string, payload: TracePayload = {}) {
  if (!isTraceEnabled()) {
    return;
  }

  const entry = {
    ts: Date.now(),
    env: "convex",
    service: "convex",
    event,
    ...payload,
  };

  console.log("[dup-trace]", JSON.stringify(entry));
}
