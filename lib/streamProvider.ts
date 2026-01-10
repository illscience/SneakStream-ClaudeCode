const PUBLIC_PROVIDER = process.env.NEXT_PUBLIC_STREAM_PROVIDER?.toLowerCase();
const PUBLIC_FLAG =
  process.env.NEXT_PUBLIC_USE_MUX === "1" ||
  process.env.NEXT_PUBLIC_MUX_ENABLED === "1";

const SERVER_PROVIDER = process.env.STREAM_PROVIDER?.toLowerCase();

function resolveProvider() {
  // Allow an explicit server-side override first so deployments can opt back into Livepeer if needed.
  if (SERVER_PROVIDER === "livepeer") {
    return "livepeer";
  }
  if (SERVER_PROVIDER === "mux") {
    return "mux";
  }

  // Respect any explicit client-side override exposed via NEXT_PUBLIC_STREAM_PROVIDER.
  if (PUBLIC_PROVIDER === "livepeer") {
    return "livepeer";
  }
  if (PUBLIC_PROVIDER === "mux") {
    return "mux";
  }

  // Legacy public flags should still enable the Mux experience automatically.
  if (PUBLIC_FLAG) {
    return "mux";
  }

  // Fall back to Mux when credentials are present or when no provider is specified.
  if (
    process.env.MUX_TOKEN_ID &&
    (process.env.MUX_TOKEN_SECRET || process.env.MUX_SECRET_KEY || process.env.MUX_SECRET)
  ) {
    return "mux";
  }

  return "mux";
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

/**
 * Get dedicated dev stream credentials for testing.
 * These are only available in development mode when the env vars are set.
 * Returns null in production or when env vars are not configured.
 */
export function getDevStreamCredentials(): {
  streamId: string;
  streamKey: string;
  playbackId: string;
  playbackUrl: string;
  rtmpIngestUrl: string;
} | null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const streamId = process.env.MUX_DEV_STREAM_ID;
  const streamKey = process.env.MUX_DEV_STREAM_KEY;
  const playbackId = process.env.MUX_DEV_PLAYBACK_ID;

  if (!streamId || !streamKey || !playbackId) {
    return null;
  }

  return {
    streamId,
    streamKey,
    playbackId,
    playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
    rtmpIngestUrl: "rtmp://global-live.mux.com:5222/app",
  };
}

/**
 * Check if dev stream mode is available (credentials are configured)
 */
export function isDevStreamAvailable(): boolean {
  return getDevStreamCredentials() !== null;
}
