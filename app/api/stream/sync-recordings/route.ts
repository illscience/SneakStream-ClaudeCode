import { NextRequest, NextResponse } from "next/server";
import { getLiveStream, getAsset } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { requireAdminFromRoute } from "@/lib/convexServer";
import { ADMIN_LIBRARY_USER_ID } from "@/lib/adminConstants";

export async function POST(request: NextRequest) {
  try {
    const { client, clerkId } = await requireAdminFromRoute();
    await request.json().catch(() => ({}));

    console.log("[sync-recordings] Starting sync for admin:", clerkId);

    // Get all ended livestreams for this user
    const streams = await client.query(api.livestream.getUserStreams, { userId: clerkId });
    console.log(`[sync-recordings] Found ${streams.length} streams for user`);

    const syncedVideos = [];
    const skippedStreams = [];
    const errors = [];

    for (const stream of streams) {
      if (!stream.streamId || stream.provider !== "mux") {
        skippedStreams.push({ streamId: stream._id, reason: "Not a Mux stream" });
        continue;
      }

      try {
        console.log(`[sync-recordings] Checking stream ${stream.streamId}...`);

        // Get the Mux live stream
        const liveStream = await getLiveStream(stream.streamId);

        if (!liveStream.recent_asset_ids || liveStream.recent_asset_ids.length === 0) {
          skippedStreams.push({ streamId: stream.streamId, reason: "No assets found" });
          continue;
        }

        for (const assetId of liveStream.recent_asset_ids) {
          console.log(`[sync-recordings] Checking asset ${assetId}...`);

          // Check if this asset already exists in the videos table
          const existingVideos = await client.query(api.videos.getUserVideos, {
            userId: ADMIN_LIBRARY_USER_ID,
          });
          const assetExists = existingVideos.some((v) => v.assetId === assetId);

          if (assetExists) {
            console.log(`[sync-recordings] Asset ${assetId} already exists, skipping`);
            continue;
          }

          // Fetch asset details from Mux
          try {
            const asset = await getAsset(assetId);

            if (asset.status !== "ready") {
              skippedStreams.push({ assetId, reason: `Asset status: ${asset.status}` });
              continue;
            }

            const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;

            if (!playbackId) {
              skippedStreams.push({ assetId, reason: "No public playback ID" });
              continue;
            }

            // Create video record
            await client.mutation(api.videos.createVideo, {
              userId: ADMIN_LIBRARY_USER_ID,
              uploadedBy: stream.startedBy || stream.userId || clerkId,
              title: stream.title || "Recorded Stream",
              description: stream.description,
              provider: "mux",
              assetId,
              playbackId,
              playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
              duration: asset.duration,
              visibility: "public",
            });

            // Update status to ready
            const videos = await client.query(api.videos.getUserVideos, {
              userId: ADMIN_LIBRARY_USER_ID,
            });
            const newVideo = videos.find((v) => v.assetId === assetId);

            if (newVideo) {
              await client.mutation(api.videos.updateVideoStatus, {
                videoId: newVideo._id,
                status: "ready",
              });
            }

            console.log(`[sync-recordings] Successfully synced asset ${assetId}`);
            syncedVideos.push({ assetId, playbackId, title: stream.title });
          } catch (assetError) {
            console.error(`[sync-recordings] Error fetching asset ${assetId}:`, assetError);
            errors.push({ assetId, error: String(assetError) });
          }
        }
      } catch (streamError) {
        console.error(`[sync-recordings] Error processing stream ${stream.streamId}:`, streamError);
        errors.push({ streamId: stream.streamId, error: String(streamError) });
      }
    }

    console.log("[sync-recordings] Sync complete:", {
      synced: syncedVideos.length,
      skipped: skippedStreams.length,
      errors: errors.length,
    });

    console.log("[sync-recordings] Skipped details:", skippedStreams);
    console.log("[sync-recordings] Error details:", errors);

    return NextResponse.json({
      success: true,
      synced: syncedVideos,
      skipped: skippedStreams,
      errors,
      summary: {
        totalStreams: streams.length,
        videosSynced: syncedVideos.length,
        streamsSkipped: skippedStreams.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[sync-recordings] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
