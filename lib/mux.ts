import { existsSync, readFileSync } from "fs";
import { join } from "path";

const MUX_BASE_URL = "https://api.mux.com";
const MUX_ENV_KEYS = new Set([
  "MUX_TOKEN_ID",
  "MUX_TOKEN",
  "MUX_TOKEN_SECRET",
  "MUX_SECRET_KEY",
  "MUX_SECRET",
]);
let didAttemptEnvLoad = false;

function loadMuxEnvFromFile() {
  if (didAttemptEnvLoad || process.env.NODE_ENV === "production") {
    return;
  }

  didAttemptEnvLoad = true;

  const envFiles = [".env.local", ".env"];
  for (const filename of envFiles) {
    const filepath = join(process.cwd(), filename);
    if (!existsSync(filepath)) {
      continue;
    }

    const contents = readFileSync(filepath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) {
        continue;
      }

      const key = match[1];
      if (!MUX_ENV_KEYS.has(key) || process.env[key]) {
        continue;
      }

      let value = match[2].trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

export function ensureMuxEnvLoaded() {
  if (process.env.MUX_TOKEN_ID && (process.env.MUX_TOKEN_SECRET || process.env.MUX_SECRET_KEY || process.env.MUX_SECRET)) {
    return;
  }

  loadMuxEnvFromFile();
}

function resolveMuxSecret() {
  return process.env.MUX_TOKEN_SECRET || process.env.MUX_SECRET_KEY || process.env.MUX_SECRET;
}

function getMuxAuthHeader() {
  ensureMuxEnvLoaded();
  const tokenId = process.env.MUX_TOKEN_ID || process.env.MUX_TOKEN;
  const tokenSecret = resolveMuxSecret();

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "MUX credentials are not configured. Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET (or legacy MUX_TOKEN / MUX_SECRET_KEY / MUX_SECRET) in your environment."
    );
  }

  const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

interface MuxRequestOptions extends RequestInit {
  json?: Record<string, unknown>;
}

async function muxRequest<T>(path: string, options: MuxRequestOptions = {}): Promise<T> {
  const url = `${MUX_BASE_URL}${path}`;
  const headers: HeadersInit = {
    Authorization: getMuxAuthHeader(),
    "Content-Type": "application/json",
    ...options.headers,
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body,
  };

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mux request failed (${response.status}): ${errorText}`);
  }

  const headerGetter = (response.headers as Headers | undefined)?.get?.bind(response.headers);
  const contentLength = headerGetter ? headerGetter("content-length") : undefined;
  const hasBody = response.status !== 204 && (headerGetter ? contentLength !== "0" : true);
  if (!hasBody) {
    return undefined as T;
  }

  const data = (await response.json()) as { data: T } | T;
  if (data && typeof data === "object" && "data" in data && (data as { data: T }).data !== undefined) {
    return (data as { data: T }).data;
  }

  return data as T;
}

export function getMuxPlaybackUrl(playbackId: string, format: "hls" | "dash" = "hls") {
  if (format === "dash") {
    return `https://stream.mux.com/${playbackId}.mpd`;
  }
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export interface MuxUpload {
  id: string;
  status: string;
  url: string;
  new_asset_settings?: {
    playback_policy?: string[];
  };
  asset_id?: string | null;
}

export async function createDirectUpload(name: string): Promise<{ uploadId: string; uploadUrl: string }> {
  const upload = await muxRequest<MuxUpload>("/video/v1/uploads", {
    method: "POST",
    json: {
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: name,
      },
      cors_origin: "*",
    },
  });

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
}

export async function cancelDirectUpload(uploadId: string): Promise<void> {
  await muxRequest(`/video/v1/uploads/${uploadId}`, {
    method: "DELETE",
  });
}

export interface MuxUploadStatus {
  id: string;
  asset_id: string | null;
  status: string;
  url: string;
  error?: {
    type: string;
    message: string;
  } | null;
}

export async function getUploadStatus(uploadId: string): Promise<MuxUploadStatus> {
  return muxRequest<MuxUploadStatus>(`/video/v1/uploads/${uploadId}`);
}

export interface MuxAssetPlaybackId {
  id: string;
  policy: string;
}

export interface MuxAssetData {
  id: string;
  status: string;
  created_at?: number;
  duration?: number;
  playback_ids?: MuxAssetPlaybackId[];
  tracks?: Array<{ type: string; max_width?: number; max_height?: number }>;
  master_access?: "none" | "temporary";
  master?: {
    status: "preparing" | "ready";
    url?: string;
  };
}

export interface MuxAssetListItem extends MuxAssetData {
  live_stream_id?: string;
  passthrough?: string;
}

export async function listAssets(params: { liveStreamId?: string; limit?: number; page?: number } = {}): Promise<MuxAssetListItem[]> {
  const searchParams = new URLSearchParams();
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.page) {
    searchParams.set("page", String(params.page));
  }
  if (params.liveStreamId) {
    searchParams.set("live_stream_id", params.liveStreamId);
  }

  const query = searchParams.toString();
  return muxRequest<MuxAssetListItem[]>(`/video/v1/assets${query ? `?${query}` : ""}`);
}

export async function getAsset(assetId: string): Promise<MuxAssetData> {
  return muxRequest<MuxAssetData>(`/video/v1/assets/${assetId}`);
}

export async function enableMasterAccess(assetId: string): Promise<MuxAssetData> {
  return muxRequest<MuxAssetData>(`/video/v1/assets/${assetId}/master-access`, {
    method: "PUT",
    json: { master_access: "temporary" },
  });
}

export async function getAssetWithMaster(assetId: string): Promise<MuxAssetData> {
  return muxRequest<MuxAssetData>(`/video/v1/assets/${assetId}`, {
    method: "GET",
  });
}

export interface MuxLiveStream {
  id: string;
  stream_key: string;
  status: string;
  playback_ids?: MuxAssetPlaybackId[];
  reconnect_window?: number;
  created_at: string;
  latency_mode: string;
  active_asset_id?: string;
  new_asset_settings?: {
    playback_policy?: string[];
  };
  recent_asset_ids?: string[];
}

export async function createLiveStream(name: string): Promise<{
  liveStreamId: string;
  streamKey: string;
  playbackId?: string;
  playbackUrl?: string;
  rtmpIngestUrl: string;
}> {
  const stream = await muxRequest<MuxLiveStream>("/video/v1/live-streams", {
    method: "POST",
    json: {
      passthrough: name,
      playback_policy: ["public"],
      new_asset_settings: {
        playback_policy: ["public"],
      },
    },
  });

  const playbackId = stream.playback_ids?.find((p) => p.policy === "public")?.id;
  return {
    liveStreamId: stream.id,
    streamKey: stream.stream_key,
    playbackId,
    playbackUrl: playbackId ? getMuxPlaybackUrl(playbackId) : undefined,
    rtmpIngestUrl: "rtmp://global-live.mux.com:5222/app",
  };
}

export async function getLiveStream(liveStreamId: string): Promise<MuxLiveStream> {
  return muxRequest<MuxLiveStream>(`/video/v1/live-streams/${liveStreamId}`);
}

export async function enableLiveStream(liveStreamId: string): Promise<void> {
  await muxRequest(`/video/v1/live-streams/${liveStreamId}/enable`, {
    method: "PUT",
  });
}

export async function disableLiveStream(liveStreamId: string): Promise<void> {
  await muxRequest(`/video/v1/live-streams/${liveStreamId}/disable`, {
    method: "PUT",
  });
}

export async function deleteLiveStream(liveStreamId: string): Promise<void> {
  await muxRequest(`/video/v1/live-streams/${liveStreamId}`, {
    method: "DELETE",
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  await muxRequest(`/video/v1/assets/${assetId}`, {
    method: "DELETE",
  });
}

export interface MuxViewerData {
  total_row_count: number | null;
  timeframe: number[];
  data: Array<{
    value: number;
    date?: string;
  }>;
}

export interface MuxClipResult {
  assetId: string;
  playbackId?: string;
  status: string;
}

export async function createClipFromAsset(
  sourceAssetId: string,
  startTime: number,
  endTime: number
): Promise<MuxClipResult> {
  const asset = await muxRequest<MuxAssetData>("/video/v1/assets", {
    method: "POST",
    json: {
      input: [
        {
          url: `mux://assets/${sourceAssetId}`,
          start_time: startTime,
          end_time: endTime,
        },
      ],
      playback_policy: ["public"],
      static_renditions: [{ resolution: "1080p" }],
    },
  });

  return {
    assetId: asset.id,
    playbackId: asset.playback_ids?.find((p) => p.policy === "public")?.id,
    status: asset.status,
  };
}

export async function getCurrentViewers(playbackId: string): Promise<number> {
  try {
    const response = await muxRequest<MuxViewerData>(
      `/data/v1/real-time/metrics/viewers?filters[]=playback_id:${playbackId}`,
      { method: "GET" }
    );

    // Return the most recent viewer count, or 0 if no data
    if (response.data && response.data.length > 0) {
      return response.data[0].value || 0;
    }

    return 0;
  } catch (error) {
    // Real-Time Data API is a premium Mux feature - silently return 0 if not available
    // Only log unexpected errors (not 404s which indicate the feature isn't enabled)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("404")) {
      console.error("Failed to fetch viewer count from Mux:", error);
    }
    return 0;
  }
}
