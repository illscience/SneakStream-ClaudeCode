import { NextRequest, NextResponse } from "next/server";
import { getLiveStream, getAsset, disableLiveStream, listAssets } from "@/lib/mux";
import { requireAdminFromRoute } from "@/lib/convexServer";
import { createTraceId, logTrace } from "@/lib/debugLog";

const ASSET_POLL_ATTEMPTS = 6;
const ASSET_POLL_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isMuxNotFoundError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("(404)") || error.message.includes("\"not_found\""));

const toTimestampMs = (value?: number) => {
  if (value === undefined || value === null) return undefined;
  return value > 1_000_000_000_000 ? value : value * 1000;
};

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

async function fetchRecordingAsset(streamId: string, preferredAssetId?: string, traceId?: string) {
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
      logTrace("stream-end-api", "poll_candidates", {
        traceId,
        streamId,
        attempt,
        preferredAssetId,
        candidateIds: uniqueCandidates,
      });
      lastAssetId = uniqueCandidates[0];
      console.log("[stream/end] Live stream data:", {
        id: liveStream.id,
        status: liveStream.status,
        active_asset_id: liveStream.active_asset_id,
        recent_asset_ids: liveStream.recent_asset_ids,
      });

      const readyCandidates: Array<{
        assetId: string;
        playbackId: string;
        duration: number | undefined;
        createdAt: number | undefined;
      }> = [];

      for (const assetId of uniqueCandidates) {
        try {
          const asset = await getAsset(assetId);
          lastStatus = asset.status;
          const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
          const createdAt = toTimestampMs(asset.created_at ? Number(asset.created_at) : undefined);

          if (asset.status === "ready" && playbackId) {
            readyCandidates.push({
              assetId,
              playbackId,
              duration: asset.duration,
              createdAt,
            });
          }

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

      if (readyCandidates.length > 0) {
        const preferredReady = preferredAssetId
          ? readyCandidates.find((candidate) => candidate.assetId === preferredAssetId)
          : undefined;

        const selected = preferredReady ||
          readyCandidates.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

        logTrace("stream-end-api", "poll_ready_asset_selected", {
          traceId,
          streamId,
          attempt,
          preferredAssetId,
          selectedAssetId: selected.assetId,
          selectedCreatedAt: selected.createdAt,
          readyCandidateIds: readyCandidates.map((candidate) => candidate.assetId),
          playbackId: selected.playbackId,
          duration: selected.duration,
        });
        return {
          assetId: selected.assetId,
          playbackId: selected.playbackId,
          duration: selected.duration,
          assetStatus: "ready",
          attempt,
        };
      }

      if (!pendingAsset) {
        lastStatus = uniqueCandidates.length ? "asset_not_found" : "no_recent_asset";
      }
    } catch (error) {
      lastError = String(error);
      logTrace("stream-end-api", "poll_error", {
        traceId,
        streamId,
        attempt,
        error: String(error),
      });
      console.error("[stream/end] Asset poll error:", error);
    }

    if (attempt < ASSET_POLL_ATTEMPTS) {
      await sleep(ASSET_POLL_DELAY_MS);
    }
  }

  if (!pendingAsset) {
    const listedAsset = await findAssetFromList(streamId);
    if (listedAsset) {
      logTrace("stream-end-api", "poll_fallback_asset_list", {
        traceId,
        streamId,
        listedAssetId: listedAsset.id,
        listedAssetStatus: listedAsset.status,
      });
      const playbackId = listedAsset.playback_ids?.find((p) => p.policy === "public")?.id;
      pendingAsset = {
        assetId: listedAsset.id,
        playbackId,
        duration: listedAsset.duration,
        assetStatus: listedAsset.status,
        createdAt: toTimestampMs(listedAsset.created_at ? Number(listedAsset.created_at) : undefined),
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
    await requireAdminFromRoute();
    const body = (await request.json().catch(() => ({}))) as {
      streamId?: string;
      traceId?: string;
    };
    const streamId = body.streamId;
    const traceId = body.traceId || createTraceId("stream-end");

    console.log("[stream/end] Received request for streamId:", streamId);
    logTrace("stream-end-api", "request_received", {
      traceId,
      streamId,
    });

    if (!streamId) {
      logTrace("stream-end-api", "request_rejected_missing_streamId", {
        traceId,
      });
      return NextResponse.json(
        { error: "Missing streamId", traceId },
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
        logTrace("stream-end-api", "pre_disable_live_stream", {
          traceId,
          streamId,
          activeAssetId: liveStream.active_asset_id,
          recentAssetIds: liveStream.recent_asset_ids,
        });
      } catch (error) {
        logTrace("stream-end-api", "pre_disable_live_stream_error", {
          traceId,
          streamId,
          error: String(error),
        });
        console.warn("[stream/end] Failed to fetch live stream before disable:", error);
      }

      console.log("[stream/end] Disabling live stream in Mux...");
      await disableLiveStream(streamId);
      console.log("[stream/end] Live stream disabled.");
    } catch (error) {
      logTrace("stream-end-api", "disable_stream_error", {
        traceId,
        streamId,
        error: String(error),
      });
      console.warn("[stream/end] Failed to disable live stream:", error);
    }

    try {
      console.log("[stream/end] Polling Mux for recording asset...");
      const result = await fetchRecordingAsset(streamId, preferredAssetId, traceId);
      assetId = result.assetId;
      playbackId = result.playbackId;
      duration = result.duration;
      logTrace("stream-end-api", "poll_complete", {
        traceId,
        streamId,
        preferredAssetId,
        result,
      });
      console.log("[stream/end] Poll result:", result);
    } catch (error) {
      // If Mux API fails (e.g., credentials not configured), allow stream to end gracefully
      logTrace("stream-end-api", "poll_mux_error", {
        traceId,
        streamId,
        error: String(error),
      });
      console.error("[stream/end] Failed to fetch Mux data (this is OK if Mux is not configured):", error);
    }

    console.log("[stream/end] Returning asset data:", { assetId, playbackId, duration });
    logTrace("stream-end-api", "response", {
      traceId,
      streamId,
      assetId,
      playbackId,
      duration,
      preferredAssetId,
    });
    return NextResponse.json({
      traceId,
      assetId,
      playbackId,
      duration,
    });
  } catch (error) {
    const traceId = createTraceId("stream-end-error");
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      logTrace("stream-end-api", "request_unauthorized", {
        traceId,
        error: String(error),
      });
      return NextResponse.json({ error: "Unauthorized", traceId }, { status: 401 });
    }
    logTrace("stream-end-api", "request_error", {
      traceId,
      error: String(error),
    });
    console.error("[stream/end] Stream end error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error), traceId },
      { status: 500 }
    );
  }
}
