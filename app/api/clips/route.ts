import { NextRequest, NextResponse } from "next/server";
import { getAuthedConvexClient } from "@/lib/convexServer";
import { createClipFromAsset, getLiveStream, getAsset } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const CLIP_DURATION_SECONDS = 15;

// POST: Create a clip from the last ~15 seconds of an active live stream
export async function POST(request: NextRequest) {
  try {
    const { client } = await getAuthedConvexClient();

    const body = await request.json();
    const livestreamId = body.livestreamId as Id<"livestreams"> | undefined;

    if (!livestreamId) {
      return NextResponse.json(
        { error: "Missing livestreamId" },
        { status: 400 }
      );
    }

    // Get the livestream from Convex
    const livestream = await client.query(api.livestream.getLivestream, {
      livestreamId,
    });

    if (!livestream) {
      return NextResponse.json(
        { error: "Livestream not found" },
        { status: 404 }
      );
    }

    if (!livestream.streamId) {
      return NextResponse.json(
        { error: "Livestream has no Mux stream ID" },
        { status: 400 }
      );
    }

    // Get the Mux live stream to find the active_asset_id
    const muxStream = await getLiveStream(livestream.streamId);
    const activeAssetId = muxStream.active_asset_id;

    if (!activeAssetId) {
      return NextResponse.json(
        { error: "No active recording asset found. Is the stream live?" },
        { status: 400 }
      );
    }

    // Get the asset to determine how far along the stream is
    const asset = await getAsset(activeAssetId);
    // For a live asset, duration grows over time. Use elapsed time as fallback.
    const elapsedSeconds =
      asset.duration ?? (Date.now() - livestream.startedAt) / 1000;

    // Calculate clip window — last ~15 seconds, with a small buffer
    // for segment availability
    const buffer = 10; // seconds of buffer for HLS segment delay
    const endTime = Math.max(0, elapsedSeconds - buffer);
    const startTime = Math.max(0, endTime - CLIP_DURATION_SECONDS);

    if (endTime - startTime < 2) {
      return NextResponse.json(
        { error: "Stream hasn't been live long enough to create a clip" },
        { status: 400 }
      );
    }

    // Create the clip via Mux
    const clip = await createClipFromAsset(activeAssetId, startTime, endTime);

    return NextResponse.json({
      clipAssetId: clip.assetId,
      clipPlaybackId: clip.playbackId,
      status: clip.status,
    });
  } catch (error) {
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

    if (asset.status === "ready") {
      const playbackId =
        asset.playback_ids?.find((p) => p.policy === "public")?.id;

      const mp4Url = playbackId
        ? `https://stream.mux.com/${playbackId}/1080p.mp4`
        : undefined;

      return NextResponse.json({
        status: "ready",
        playbackId,
        mp4Url,
      });
    }

    if (asset.status === "errored") {
      return NextResponse.json({ status: "failed" });
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
