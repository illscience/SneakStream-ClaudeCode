import { NextRequest, NextResponse } from "next/server";
import { getLiveStream, getAsset, disableLiveStream, listAssets } from "@/lib/mux";

const ASSET_POLL_ATTEMPTS = 6;
const ASSET_POLL_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isMuxNotFoundError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("(404)") || error.message.includes("\"not_found\""));

async function findAssetFromList(streamId: string) {
  try {
    const assets = await listAssets({ liveStreamId: streamId, limit: 10 });
    if (assets.length > 0) {
      return assets[0];
    }
  } catch (error) {
    console.warn("[stream/end] Live stream asset list query failed, retrying without filter:", error);
  }

  try {
    const assets = await listAssets({ limit: 50 });
    const matching = assets.filter((asset) => asset.live_stream_id === streamId);
    if (matching.length > 0) {
      return matching.sort((a, b) => (Number(b.created_at || 0) - Number(a.created_at || 0)))[0];
    }
  } catch (error) {
    console.warn("[stream/end] Asset list fallback failed:", error);
  }

  return undefined;
}

async function fetchRecordingAsset(streamId: string, preferredAssetId?: string) {
  let lastAssetId: string | undefined;
  let lastStatus: string | undefined;
  let lastError: string | undefined;
  let pendingAsset:
    | {
        assetId: string;
        playbackId?: string;
        duration?: number;
        assetStatus?: string;
        createdAt?: number;
      }
    | undefined;

  for (let attempt = 1; attempt <= ASSET_POLL_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[stream/end] Poll attempt ${attempt}/${ASSET_POLL_ATTEMPTS}`);
      const liveStream = await getLiveStream(streamId);
      const candidateIds = [
        preferredAssetId,
        liveStream.active_asset_id,
        ...(liveStream.recent_asset_ids || []),
      ].filter(Boolean) as string[];
      const seen = new Set<string>();
      const uniqueCandidates = candidateIds.filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      lastAssetId = uniqueCandidates[0];
      console.log("[stream/end] Live stream data:", {
        id: liveStream.id,
        status: liveStream.status,
        active_asset_id: liveStream.active_asset_id,
        recent_asset_ids: liveStream.recent_asset_ids,
      });

      for (const assetId of uniqueCandidates) {
        try {
          const asset = await getAsset(assetId);
          lastStatus = asset.status;
          const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
          if (asset.status === "ready" && playbackId) {
            return {
              assetId,
              playbackId,
              duration: asset.duration,
              assetStatus: asset.status,
              attempt,
            };
          }

          const createdAt = asset.created_at ? Number(asset.created_at) : undefined;
          if (
            !pendingAsset ||
            (createdAt && (!pendingAsset.createdAt || createdAt > pendingAsset.createdAt))
          ) {
            pendingAsset = {
              assetId,
              playbackId: undefined,
              duration: asset.duration,
              assetStatus: asset.status,
              createdAt,
            };
          }
        } catch (error) {
          if (!isMuxNotFoundError(error)) {
            throw error;
          }
        }
      }

      if (!pendingAsset) {
        lastStatus = uniqueCandidates.length ? "asset_not_found" : "no_recent_asset";
      }
    } catch (error) {
      lastError = String(error);
      console.error("[stream/end] Asset poll error:", error);
    }

    if (attempt < ASSET_POLL_ATTEMPTS) {
      await sleep(ASSET_POLL_DELAY_MS);
    }
  }

  if (!pendingAsset) {
    const listedAsset = await findAssetFromList(streamId);
    if (listedAsset) {
      const playbackId = listedAsset.playback_ids?.find((p) => p.policy === "public")?.id;
      pendingAsset = {
        assetId: listedAsset.id,
        playbackId,
        duration: listedAsset.duration,
        assetStatus: listedAsset.status,
        createdAt: listedAsset.created_at ? Number(listedAsset.created_at) : undefined,
      };
    }
  }

  if (pendingAsset) {
    return {
      ...pendingAsset,
      assetStatus: pendingAsset.assetStatus || lastStatus,
      error: lastError,
    };
  }

  return {
    assetId: lastAssetId,
    playbackId: undefined,
    duration: undefined,
    assetStatus: lastStatus,
    error: lastError,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { streamId } = await request.json();

    console.log("[stream/end] Received request for streamId:", streamId);

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing streamId" },
        { status: 400 }
      );
    }

    // Mux creates an asset automatically when recording is enabled.
    // Poll briefly for the asset to become ready.
    let assetId: string | undefined;
    let playbackId: string | undefined;
    let duration: number | undefined;
    let preferredAssetId: string | undefined;

    try {
      try {
        const liveStream = await getLiveStream(streamId);
        preferredAssetId = liveStream.active_asset_id;
      } catch (error) {
        console.warn("[stream/end] Failed to fetch live stream before disable:", error);
      }

      console.log("[stream/end] Disabling live stream in Mux...");
      await disableLiveStream(streamId);
      console.log("[stream/end] Live stream disabled.");
    } catch (error) {
      console.warn("[stream/end] Failed to disable live stream:", error);
    }

    try {
      console.log("[stream/end] Polling Mux for recording asset...");
      const result = await fetchRecordingAsset(streamId, preferredAssetId);
      assetId = result.assetId;
      playbackId = result.playbackId;
      duration = result.duration;
      console.log("[stream/end] Poll result:", result);
    } catch (error) {
      // If Mux API fails (e.g., credentials not configured), allow stream to end gracefully
      console.error("[stream/end] Failed to fetch Mux data (this is OK if Mux is not configured):", error);
    }

    console.log("[stream/end] Returning asset data:", { assetId, playbackId, duration });
    return NextResponse.json({
      assetId,
      playbackId,
      duration,
    });
  } catch (error) {
    console.error("[stream/end] Stream end error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
