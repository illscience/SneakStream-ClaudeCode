import { NextRequest, NextResponse } from "next/server";
import { deleteAsset } from "@/lib/mux";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    const { client } = await requireAdminFromRoute();
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    console.log("[video/delete] Deleting video:", videoId);

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

    // Delete from Mux if it's a Mux video with an asset ID
    if (video.provider === "mux" && video.assetId) {
      try {
        console.log("[video/delete] Deleting Mux asset:", video.assetId);
        await deleteAsset(video.assetId);
        console.log("[video/delete] Mux asset deleted successfully");
      } catch (muxError) {
        console.error("[video/delete] Failed to delete Mux asset:", muxError);
        // Continue with database deletion even if Mux deletion fails
        // (asset might already be deleted)
      }
    }

    // Delete from database
    await client.mutation(api.videos.deleteVideo, {
      videoId: videoId as Id<"videos">
    });

    console.log("[video/delete] Video deleted from database");

    return NextResponse.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[video/delete] Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
