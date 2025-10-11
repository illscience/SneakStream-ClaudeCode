import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/lib/mux";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { env } from "process";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// List all Mux assets
async function listAllMuxAssets() {
  const MUX_BASE_URL = "https://api.mux.com";
  const tokenId = env.MUX_TOKEN_ID || env.MUX_TOKEN;
  const tokenSecret = env.MUX_TOKEN_SECRET || env.MUX_SECRET_KEY;

  if (!tokenId || !tokenSecret) {
    throw new Error("MUX credentials not configured");
  }

  const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");

  const response = await fetch(`${MUX_BASE_URL}/video/v1/assets`, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list Mux assets: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    console.log("[import-mux-assets] Starting import for user:", userId);

    // Get all Mux assets
    const muxAssets = await listAllMuxAssets();
    console.log(`[import-mux-assets] Found ${muxAssets.length} total Mux assets`);

    // Get existing videos from database
    const existingVideos = await convex.query(api.videos.getUserVideos, { userId });
    const existingAssetIds = new Set(existingVideos.map((v) => v.assetId).filter(Boolean));

    const imported = [];
    const skipped = [];
    const errors = [];

    for (const asset of muxAssets) {
      try {
        // Skip if asset already exists in database
        if (existingAssetIds.has(asset.id)) {
          skipped.push({ assetId: asset.id, reason: "Already in library" });
          continue;
        }

        // Only import ready assets
        if (asset.status !== "ready") {
          skipped.push({ assetId: asset.id, reason: `Status: ${asset.status}` });
          continue;
        }

        // Get playback ID
        const playbackId = asset.playback_ids?.find((p: any) => p.policy === "public")?.id;
        if (!playbackId) {
          skipped.push({ assetId: asset.id, reason: "No public playback ID" });
          continue;
        }

        // Determine title from passthrough or live_stream_id
        let title = "Imported Recording";
        if (asset.passthrough) {
          title = asset.passthrough;
        } else if (asset.live_stream_id) {
          title = `Stream Recording`;
        }

        // Create video record
        await convex.mutation(api.videos.createVideo, {
          userId,
          title,
          description: `Imported from Mux${asset.live_stream_id ? ` (Stream ID: ${asset.live_stream_id})` : ""}`,
          provider: "mux",
          assetId: asset.id,
          playbackId,
          playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
          duration: asset.duration,
          visibility: "public",
        });

        // Update status to ready
        const updatedVideos = await convex.query(api.videos.getUserVideos, { userId });
        const newVideo = updatedVideos.find((v) => v.assetId === asset.id);

        if (newVideo) {
          await convex.mutation(api.videos.updateVideoStatus, {
            videoId: newVideo._id,
            status: "ready",
          });
        }

        console.log(`[import-mux-assets] Imported asset ${asset.id}`);
        imported.push({
          assetId: asset.id,
          playbackId,
          title,
          duration: asset.duration,
          liveStreamId: asset.live_stream_id,
        });
      } catch (assetError) {
        console.error(`[import-mux-assets] Error importing asset ${asset.id}:`, assetError);
        errors.push({ assetId: asset.id, error: String(assetError) });
      }
    }

    console.log("[import-mux-assets] Import complete:", {
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      summary: {
        totalAssets: muxAssets.length,
        assetsImported: imported.length,
        assetsSkipped: skipped.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error("[import-mux-assets] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
