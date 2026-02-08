import { NextRequest, NextResponse } from "next/server";
import { enableMasterAccess, getAssetWithMaster } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireAdminFromRoute } from "@/lib/convexServer";

const MASTER_URL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// POST: Request a download (enables master access, Mux webhook will update status)
export async function POST(request: NextRequest) {
  try {
    const { client } = await requireAdminFromRoute();

    const body = await request.json();
    const videoId = body.videoId;

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

    // Check if already ready and not expired
    if (
      video.masterStatus === "ready" &&
      video.masterUrl &&
      video.masterExpiresAt &&
      video.masterExpiresAt > Date.now()
    ) {
      return NextResponse.json({
        status: "ready",
        downloadUrl: video.masterUrl,
      });
    }

    // Check current Mux asset state
    const asset = await getAssetWithMaster(video.assetId);

    // If master URL is already ready in Mux, update Convex and return immediately
    if (asset.master?.status === "ready" && asset.master.url) {
      const expiresAt = Date.now() + MASTER_URL_EXPIRY_MS;
      await client.mutation(api.videos.updateMasterStatus, {
        videoId: videoId as Id<"videos">,
        status: "ready",
        masterUrl: asset.master.url,
        masterExpiresAt: expiresAt,
      });
      return NextResponse.json({
        status: "ready",
        downloadUrl: asset.master.url,
      });
    }

    // Enable master access if not already enabled
    // Mux will send webhook events: video.asset.master.preparing -> video.asset.master.ready
    if (asset.master_access !== "temporary") {
      await enableMasterAccess(video.assetId);
    }

    // Set status to preparing in Convex (webhook will also do this, but this provides immediate feedback)
    await client.mutation(api.videos.requestMasterDownload, {
      videoId: videoId as Id<"videos">,
    });

    return NextResponse.json({ status: "preparing" });
  } catch (error) {
    const errorStr = String(error);

    if (
      errorStr.includes("Unauthorized") ||
      errorStr.includes("Not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (errorStr.includes("404")) {
      return NextResponse.json(
        { error: "Asset not found in Mux" },
        { status: 404 }
      );
    }

    console.error("[video/download POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: errorStr },
      { status: 500 }
    );
  }
}

// GET: Check status of a specific video (fallback if webhook missed)
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

    const video = await client.query(api.videos.getVideo, {
      videoId: videoId as Id<"videos">,
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Check if expired
    if (video.masterExpiresAt && video.masterExpiresAt < Date.now()) {
      await client.mutation(api.videos.clearExpiredMasters, {
        videoIds: [videoId as Id<"videos">],
      });
      return NextResponse.json({ status: "expired" });
    }

    // If already ready
    if (video.masterStatus === "ready" && video.masterUrl) {
      return NextResponse.json({
        status: "ready",
        downloadUrl: video.masterUrl,
      });
    }

    // If preparing, check Mux directly (fallback if webhook missed)
    if (video.masterStatus === "preparing" && video.assetId) {
      const asset = await getAssetWithMaster(video.assetId);

      if (asset.master?.status === "ready" && asset.master.url) {
        const expiresAt = Date.now() + MASTER_URL_EXPIRY_MS;
        await client.mutation(api.videos.updateMasterStatus, {
          videoId: videoId as Id<"videos">,
          status: "ready",
          masterUrl: asset.master.url,
          masterExpiresAt: expiresAt,
        });
        return NextResponse.json({
          status: "ready",
          downloadUrl: asset.master.url,
        });
      }

      return NextResponse.json({ status: "preparing" });
    }

    return NextResponse.json({ status: "none" });
  } catch (error) {
    const errorStr = String(error);

    if (
      errorStr.includes("Unauthorized") ||
      errorStr.includes("Not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[video/download GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: errorStr },
      { status: 500 }
    );
  }
}
