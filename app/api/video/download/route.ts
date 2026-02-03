import { NextRequest, NextResponse } from "next/server";
import { enableMasterAccess, getAssetWithMaster } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireAdminFromRoute } from "@/lib/convexServer";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIME_MS = 1800000; // 30 minutes for very large videos

async function pollForMasterUrl(assetId: string): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    const asset = await getAssetWithMaster(assetId);

    if (asset.master?.status === "ready" && asset.master.url) {
      return asset.master.url;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timeout waiting for master download URL");
}

export async function GET(request: NextRequest) {
  try {
    const { client } = await requireAdminFromRoute();

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId parameter" },
        { status: 400 }
      );
    }

    // Get video from Convex
    const video = await client.query(api.videos.getVideo, {
      videoId: videoId as Id<"videos">,
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.provider !== "mux") {
      return NextResponse.json(
        { error: "Download only supported for Mux videos" },
        { status: 400 }
      );
    }

    if (!video.assetId) {
      return NextResponse.json(
        { error: "Video has no Mux asset ID" },
        { status: 400 }
      );
    }

    // Check current asset state
    const asset = await getAssetWithMaster(video.assetId);

    // If master URL is already ready, return it immediately
    if (asset.master?.status === "ready" && asset.master.url) {
      return NextResponse.json({ downloadUrl: asset.master.url });
    }

    // If master access isn't enabled yet, enable it
    if (asset.master_access !== "temporary") {
      await enableMasterAccess(video.assetId);
    }

    // Poll until ready
    const downloadUrl = await pollForMasterUrl(video.assetId);

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const errorStr = String(error);

    if (
      errorStr.includes("Unauthorized") ||
      errorStr.includes("Not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (errorStr.includes("Timeout")) {
      return NextResponse.json(
        { error: "Download URL generation timed out" },
        { status: 408 }
      );
    }

    if (errorStr.includes("404")) {
      return NextResponse.json(
        { error: "Asset not found in Mux" },
        { status: 404 }
      );
    }

    console.error("[video/download] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: errorStr },
      { status: 500 }
    );
  }
}
