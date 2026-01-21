import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateSignedPlaybackUrl, isSignedPlaybackAvailable } from "@/lib/muxSigned";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, expirationSecs } = body;

    // Default from env (8 hours), min 60 seconds, max 7 days
    const defaultExpiry = parseInt(process.env.MUX_TOKEN_EXPIRY_SECS || "28800", 10);
    const expiry = Math.min(Math.max(expirationSecs || defaultExpiry, 60), 604800);

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Fetch video details from Convex
    const video = await convex.query(api.videos.getVideo, {
      videoId: videoId as Id<"videos">,
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (!video.playbackId) {
      return NextResponse.json(
        { error: "Video has no playback ID" },
        { status: 400 }
      );
    }

    // Check if this is a PPV video
    if (video.visibility === "ppv") {
      // Check bundled entitlement (includes linked livestream access)
      const hasAccess = await convex.query(api.entitlements.hasBundledEntitlement, {
        userId,
        videoId: videoId as Id<"videos">,
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: "You do not have access to this video" },
          { status: 403 }
        );
      }
    }

    // Check if signed playback is required and available
    if (video.playbackPolicy === "signed") {
      const signedAvailable = await isSignedPlaybackAvailable();
      if (!signedAvailable) {
        return NextResponse.json(
          { error: "Signed playback is not configured" },
          { status: 500 }
        );
      }

      // Generate signed URL with configurable expiry
      const signedUrl = await generateSignedPlaybackUrl(video.playbackId, expiry);
      return NextResponse.json({ url: signedUrl, signed: true, expiresIn: expiry });
    }

    // For public videos, return the standard URL
    const publicUrl = `https://stream.mux.com/${video.playbackId}.m3u8`;
    return NextResponse.json({ url: publicUrl, signed: false });
  } catch (error) {
    console.error("[playback/signed-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate playback URL", details: String(error) },
      { status: 500 }
    );
  }
}
