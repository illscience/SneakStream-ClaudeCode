const PUBLIC_PROVIDER = process.env.NEXT_PUBLIC_STREAM_PROVIDER?.toLowerCase();
const PUBLIC_FLAG =
  process.env.NEXT_PUBLIC_USE_MUX === "1" ||
  process.env.NEXT_PUBLIC_MUX_ENABLED === "1";

const SERVER_PROVIDER = process.env.STREAM_PROVIDER?.toLowerCase();

function resolveProvider() {
  if (SERVER_PROVIDER) {
    return SERVER_PROVIDER;
  }
  if (PUBLIC_PROVIDER) {
    return PUBLIC_PROVIDER;
  }
  if (PUBLIC_FLAG) {
    return "mux";
  }
  if (process.env.MUX_TOKEN_ID && (process.env.MUX_TOKEN_SECRET || process.env.MUX_SECRET_KEY)) {
    return "mux";
  }
  return "livepeer";
}

export function getStreamProvider(): "mux" | "livepeer" {
  return resolveProvider() === "mux" ? "mux" : "livepeer";
}

export function isMuxEnabled(): boolean {
  return getStreamProvider() === "mux";
}

export function isLivepeerEnabled(): boolean {
  return !isMuxEnabled();
}
