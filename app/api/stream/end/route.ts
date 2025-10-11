import { NextRequest, NextResponse } from "next/server";
import { getLiveStream, getAsset } from "@/lib/mux";

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

    // Mux creates an asset automatically when recording is enabled
    // The asset might not be immediately available, so we check
    let assetId: string | undefined;
    let playbackId: string | undefined;
    let duration: number | undefined;

    try {
      // Get the live stream to find the associated asset
      console.log("[stream/end] Fetching live stream from Mux...");
      const liveStream = await getLiveStream(streamId);
      console.log("[stream/end] Live stream data:", {
        id: liveStream.id,
        status: liveStream.status,
        recent_asset_ids: liveStream.recent_asset_ids,
      });

      // Check if there's a recent asset created from this stream
      // Mux includes asset info in the live stream response after stream ends
      if (liveStream.recent_asset_ids && liveStream.recent_asset_ids.length > 0) {
        assetId = liveStream.recent_asset_ids[0];
        console.log("[stream/end] Found asset ID:", assetId);

        try {
          const asset = await getAsset(assetId);
          console.log("[stream/end] Asset details:", {
            id: asset.id,
            status: asset.status,
            duration: asset.duration,
            playback_ids: asset.playback_ids,
          });
          playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
          duration = asset.duration;
        } catch (error) {
          console.error("[stream/end] Asset not ready yet:", error);
        }
      } else {
        console.warn("[stream/end] No recent_asset_ids found. Stream may not have been configured for recording.");
      }
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
