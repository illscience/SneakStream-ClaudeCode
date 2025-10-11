import { NextRequest, NextResponse } from "next/server";
import { getLiveStream, getAsset } from "@/lib/mux";

export async function POST(request: NextRequest) {
  try {
    const { streamId } = await request.json();

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing streamId" },
        { status: 400 }
      );
    }

    // Get the live stream to find the associated asset
    const liveStream = await getLiveStream(streamId);

    // Mux creates an asset automatically when recording is enabled
    // The asset might not be immediately available, so we check
    let assetId: string | undefined;
    let playbackId: string | undefined;
    let duration: number | undefined;

    // Check if there's a recent asset created from this stream
    // Mux includes asset info in the live stream response after stream ends
    if (liveStream.recent_asset_ids && liveStream.recent_asset_ids.length > 0) {
      assetId = liveStream.recent_asset_ids[0];

      try {
        const asset = await getAsset(assetId);
        playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
        duration = asset.duration;
      } catch (error) {
        console.error("Asset not ready yet:", error);
      }
    }

    return NextResponse.json({
      assetId,
      playbackId,
      duration,
    });
  } catch (error) {
    console.error("Stream end error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
