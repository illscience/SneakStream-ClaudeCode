import { NextRequest, NextResponse } from "next/server";
import { getAsset, getMuxPlaybackUrl, getUploadStatus } from "@/lib/mux";
import { getLivepeerAsset } from "@/lib/livepeer";
import { getStreamProvider } from "@/lib/streamProvider";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    await requireAdminFromRoute();
    const { uploadId, assetId, provider: providerOverride } = await request.json();
    const provider = (providerOverride || getStreamProvider()).toLowerCase();

    if (provider === "mux") {
      if (!uploadId && !assetId) {
        return NextResponse.json({ error: "uploadId or assetId is required" }, { status: 400 });
      }

      if (uploadId) {
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
      }

      const asset = await getAsset(assetId);
      const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
      const playbackUrl = playbackId ? getMuxPlaybackUrl(playbackId) : undefined;

      return NextResponse.json({
        provider: "mux",
        assetId,
        status: asset.status,
        assetStatus: asset.status,
        playbackId,
        playbackUrl,
        duration: asset.duration,
      });
    }

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await getLivepeerAsset(assetId);
    return NextResponse.json({ provider: "livepeer", ...asset });
  } catch (error) {
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
