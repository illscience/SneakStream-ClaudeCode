import { NextRequest, NextResponse } from "next/server";
import { deleteAsset } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    const { client } = await requireAdminFromRoute();
    const { videoId, force } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    console.log("[video/delete] Deleting video:", videoId, { force: !!force });

    // Get video details from database
    const video = await client.query(api.videos.getVideo, {
      videoId: videoId as Id<"videos">
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Delete from database FIRST (checks for crate purchases)
    // This prevents orphaning Mux assets if the safeguard blocks deletion
    await client.mutation(api.videos.deleteVideo, {
      videoId: videoId as Id<"videos">,
      force: !!force,
    });

    console.log("[video/delete] Video deleted from database");

    // Delete from Mux if it's a Mux video with an asset ID
    if (video.provider === "mux" && video.assetId) {
      try {
        console.log("[video/delete] Deleting Mux asset:", video.assetId);
        await deleteAsset(video.assetId);
        console.log("[video/delete] Mux asset deleted successfully");
      } catch (muxError) {
        console.error("[video/delete] Failed to delete Mux asset:", muxError);
        // Continue - database record is already deleted
        // Mux asset might already be deleted or will be cleaned up later
      }
    }

    return NextResponse.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes("Unauthorized") || errorStr.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Check for crate purchases safeguard error
    if (errorStr.includes("crate purchase(s) reference this recording")) {
      // Extract count from error message: "Cannot delete video: X crate purchase(s)..."
      const countMatch = errorStr.match(/(\d+) crate purchase/);
      const crateCount = countMatch ? parseInt(countMatch[1], 10) : 0;
      console.log("[video/delete] Blocked by safeguard:", errorStr, { crateCount });
      return NextResponse.json(
        { error: "Video has crate purchases", details: errorStr, requiresForce: true, crateCount },
        { status: 409 } // Conflict
      );
    }
    console.error("[video/delete] Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: errorStr },
      { status: 500 }
    );
  }
}
