type TracePayload = Record<string, unknown>;

const DUPLICATE_TRACE_FLAG = "1";

export function isDuplicateTraceEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }

  return (
    process.env.DEBUG_DUPLICATE_ASSET_TRACE === DUPLICATE_TRACE_FLAG ||
    process.env.NEXT_PUBLIC_DEBUG_DUPLICATE_ASSET_TRACE === DUPLICATE_TRACE_FLAG
  );
}

export function logTrace(service: string, event: string, payload: TracePayload = {}) {
  if (!isDuplicateTraceEnabled()) {
    return;
  }

  const entry = {
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV ?? "unknown",
    service,
    event,
    ...payload,
  };

  console.log("[dup-trace]", JSON.stringify(entry));
}

export function createTraceId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}
