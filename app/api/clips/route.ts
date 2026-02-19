import { NextRequest, NextResponse } from "next/server";
import { getAuthedConvexClient } from "@/lib/convexServer";
import { createClipFromAsset, getLiveStream, getAsset } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const CLIP_DURATION_SECONDS = 15;

// Resolve source asset ID and clip time window.
// Supports both live streams (via livestreamId) and VOD (via videoId).
async function resolveClipSource(
  client: Awaited<ReturnType<typeof getAuthedConvexClient>>["client"],
  body: { livestreamId?: string; videoId?: string; currentTime?: number }
): Promise<{ assetId: string; startTime: number; endTime: number }> {
  // --- Live stream path ---
  if (body.livestreamId) {
    const livestreamId = body.livestreamId as Id<"livestreams">;
    const livestream = await client.query(api.livestream.getLivestream, {
      livestreamId,
    });

    if (!livestream) throw { status: 404, error: "Livestream not found" };
    if (!livestream.streamId)
      throw { status: 400, error: "Livestream has no Mux stream ID" };

    const muxStream = await getLiveStream(livestream.streamId);
    const activeAssetId = muxStream.active_asset_id;
    if (!activeAssetId)
      throw {
        status: 400,
        error: "No active recording asset found. Is the stream live?",
      };

    const asset = await getAsset(activeAssetId);
    const elapsedSeconds =
      asset.duration ?? (Date.now() - livestream.startedAt) / 1000;

    // Buffer for HLS segment delay on live streams
    const buffer = 10;
    const endTime = Math.max(0, elapsedSeconds - buffer);
    const startTime = Math.max(0, endTime - CLIP_DURATION_SECONDS);

    if (endTime - startTime < 2)
      throw {
        status: 400,
        error: "Stream hasn't been live long enough to create a clip",
      };

    return { assetId: activeAssetId, startTime, endTime };
  }

  // --- VOD path ---
  if (body.videoId) {
    const videoId = body.videoId as Id<"videos">;
    const video = await client.query(api.videos.getVideo, { videoId });

    if (!video) throw { status: 404, error: "Video not found" };
    if (!video.assetId) throw { status: 400, error: "Video has no Mux asset" };
    if (video.provider !== "mux")
      throw { status: 400, error: "Clip only supported for Mux videos" };

    const duration = video.duration ?? 0;
    if (duration < 2)
      throw { status: 400, error: "Video is too short to clip" };

    // Clip 15 seconds ending at the current playhead, or end of video
    const endTime = body.currentTime != null
      ? Math.min(body.currentTime, duration)
      : duration;
    const startTime = Math.max(0, endTime - CLIP_DURATION_SECONDS);

    return { assetId: video.assetId, startTime, endTime };
  }

  throw { status: 400, error: "Missing livestreamId or videoId" };
}

// POST: Create a ~15 second clip from a live stream or recorded video
export async function POST(request: NextRequest) {
  try {
    console.log("[clips POST] Starting clip creation...");
    const { client } = await getAuthedConvexClient();
    const body = await request.json();
    console.log("[clips POST] Request body:", body);

    const { assetId, startTime, endTime } = await resolveClipSource(
      client,
      body
    );
    console.log("[clips POST] Resolved source:", { assetId, startTime, endTime });

    const clip = await createClipFromAsset(assetId, startTime, endTime);
    console.log("[clips POST] Mux clip created:", clip);

    return NextResponse.json({
      clipAssetId: clip.assetId,
      clipPlaybackId: clip.playbackId,
      status: clip.status,
    });
  } catch (error: unknown) {
    // Structured errors from resolveClipSource
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      "error" in error
    ) {
      const e = error as { status: number; error: string };
      return NextResponse.json({ error: e.error }, { status: e.status });
    }

    const errorStr = String(error);

    if (
      errorStr.includes("Unauthorized") ||
      errorStr.includes("Not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[clips POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create clip", details: errorStr },
      { status: 500 }
    );
  }
}

// GET: Check clip status and return download/share URL when ready
export async function GET(request: NextRequest) {
  try {
    await getAuthedConvexClient();

    const { searchParams } = new URL(request.url);
    const clipAssetId = searchParams.get("clipAssetId");

    if (!clipAssetId) {
      return NextResponse.json(
        { error: "Missing clipAssetId parameter" },
        { status: 400 }
      );
    }

    // Check Mux asset status directly
    const asset = await getAsset(clipAssetId);

    if (asset.status === "errored") {
      return NextResponse.json({ status: "failed" });
    }

    // Asset must be ready AND the static MP4 rendition must be ready
    // (MP4 encoding takes longer than HLS)
    if (asset.status === "ready") {
      const files = asset.static_renditions?.files ?? [];
      const rendition = files.find((r) => r.status === "ready");

      if (rendition) {
        const playbackId =
          asset.playback_ids?.find((p) => p.policy === "public")?.id;

        // Use the rendition's actual filename (e.g. "1080p.mp4")
        const mp4Url = playbackId
          ? `https://stream.mux.com/${playbackId}/${rendition.name}`
          : undefined;

        return NextResponse.json({
          status: "ready",
          playbackId,
          mp4Url,
        });
      }

      // Check if any rendition errored or was skipped
      const failed = files.find(
        (r) => r.status === "errored" || r.status === "skipped"
      );
      if (failed) {
        return NextResponse.json({ status: "failed" });
      }

      // Asset is ready but MP4 is still encoding
      return NextResponse.json({ status: "preparing" });
    }

    return NextResponse.json({ status: "preparing" });
  } catch (error) {
    const errorStr = String(error);

    if (
      errorStr.includes("Unauthorized") ||
      errorStr.includes("Not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[clips GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to check clip status", details: errorStr },
      { status: 500 }
    );
  }
}
