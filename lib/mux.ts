import { env } from "process";

const MUX_BASE_URL = "https://api.mux.com";

function resolveMuxSecret() {
  return env.MUX_TOKEN_SECRET || env.MUX_SECRET_KEY;
}

function getMuxAuthHeader() {
  const tokenId = env.MUX_TOKEN_ID || env.MUX_TOKEN;
  const tokenSecret = resolveMuxSecret();

  if (!tokenId || !tokenSecret) {
    throw new Error("MUX credentials are not configured. Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET (or legacy MUX_TOKEN / MUX_SECRET_KEY) in your environment.");
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
  duration?: number;
  playback_ids?: MuxAssetPlaybackId[];
  tracks?: Array<{ type: string; max_width?: number; max_height?: number }>;
}

export async function getAsset(assetId: string): Promise<MuxAssetData> {
  return muxRequest<MuxAssetData>(`/video/v1/assets/${assetId}`);
}

export interface MuxLiveStream {
  id: string;
  stream_key: string;
  status: string;
  playback_ids?: MuxAssetPlaybackId[];
  reconnect_window?: number;
  created_at: string;
  latency_mode: string;
  new_asset_settings?: {
    playback_policy?: string[];
  };
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

export async function deleteLiveStream(liveStreamId: string): Promise<void> {
  await muxRequest(`/video/v1/live-streams/${liveStreamId}`, {
    method: "DELETE",
  });
}
