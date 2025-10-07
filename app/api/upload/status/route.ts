import { NextRequest, NextResponse } from "next/server";
import { getAsset, getMuxPlaybackUrl, getUploadStatus } from "@/lib/mux";

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: "uploadId is required" },
        { status: 400 }
      );
    }

    const upload = await getUploadStatus(uploadId);

    let playbackId: string | undefined;
    let playbackUrl: string | undefined;
    let duration: number | undefined;
    let assetStatus: string | undefined;

    if (upload.asset_id) {
      const asset = await getAsset(upload.asset_id);
      assetStatus = asset.status;
      playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
      playbackUrl = playbackId ? getMuxPlaybackUrl(playbackId) : undefined;
      duration = asset.duration;
    }

    return NextResponse.json({
      provider: "mux",
      uploadId,
      status: upload.status,
      assetId: upload.asset_id,
      assetStatus,
      playbackId,
      playbackUrl,
      duration,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
