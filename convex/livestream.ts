import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { ADMIN_LIBRARY_USER_ID, requireAdmin, getAuthenticatedUser } from "./adminSettings";

// Get the current active stream
export const getActiveStream = query({
  handler: async (ctx) => {
    const activeStream = await ctx.db
      .query("livestreams")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    return activeStream;
  },
});

// Get all streams by a user
export const getUserStreams = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("livestreams")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    return streams;
  },
});

// Get a stream by provider stream ID
export const getStreamByStreamId = query({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("livestreams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .order("desc")
      .first();
  },
});

// Get a livestream by its Convex ID
export const getLivestream = query({
  args: { livestreamId: v.id("livestreams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.livestreamId);
  },
});

// Update startedAt when Mux stream actually goes active (receives video frames)
// This is called by the Mux webhook when live_stream.active fires
export const updateStreamStartedAt = mutation({
  args: {
    streamId: v.string(), // Mux stream ID
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the livestream by Mux stream ID
    const stream = await ctx.db
      .query("livestreams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!stream) {
      console.warn("[updateStreamStartedAt] Stream not found:", args.streamId);
      return null;
    }

    // Only update if stream is active (don't update ended streams)
    if (stream.status !== "active") {
      console.log("[updateStreamStartedAt] Stream not active, skipping:", args.streamId);
      return null;
    }

    // Only update startedAt ONCE - on the first active event
    // This prevents reconnects from resetting the timeline
    if (stream.startedAtFromWebhook) {
      console.log("[updateStreamStartedAt] Already updated from webhook, skipping:", args.streamId);
      return null;
    }

    // Update startedAt to accurate timestamp and mark as webhook-updated
    await ctx.db.patch(stream._id, {
      startedAt: args.startedAt,
      startedAtFromWebhook: true,
    });

    console.log("[updateStreamStartedAt] Updated startedAt for stream:", {
      streamId: args.streamId,
      convexId: stream._id,
      oldStartedAt: stream.startedAt,
      newStartedAt: args.startedAt,
    });

    return stream._id;
  },
});

// Start a new stream (end any existing active streams first)
// Admin only - only admins can start streams
export const startStream = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    provider: v.optional(v.string()),
    streamId: v.optional(v.string()),
    streamKey: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    rtmpIngestUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can start streams
    const userId = await requireAdmin(ctx);

    // Look up user info for userName
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    const userName = user?.alias ?? "Admin";

    // First, end any existing active streams
    const existingActiveStreams = await ctx.db
      .query("livestreams")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const stream of existingActiveStreams) {
      await ctx.db.patch(stream._id, {
        status: "ended",
        endedAt: Date.now(),
      });
    }

    // Create new stream (default to PPV)
    const newStreamId = await ctx.db.insert("livestreams", {
      userId,
      userName,
      startedBy: userId,
      title: args.title,
      description: args.description,
      status: "active",
      startedAt: Date.now(),
      viewerCount: 0,
      provider: args.provider || "mux",
      streamId: args.streamId,
      streamKey: args.streamKey,
      playbackId: args.playbackId,
      playbackUrl: args.playbackUrl,
      rtmpIngestUrl: args.rtmpIngestUrl,
      visibility: "ppv", // Livestreams default to PPV
      price: 500, // Default price $5.00
    });

    return newStreamId;
  },
});

// End a stream and optionally save recording to library
// Admin only - only admins can end streams
export const endStream = mutation({
  args: {
    streamId: v.id("livestreams"),
    assetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can end streams
    const userId = await requireAdmin(ctx);

    console.log("[livestream.endStream] called", {
      streamId: args.streamId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      duration: args.duration,
    });

    const stream = await ctx.db.get(args.streamId);
    if (!stream) {
      console.warn("[livestream.endStream] stream not found", {
        streamId: args.streamId,
      });
      throw new Error("Stream not found");
    }

    await ctx.db.patch(args.streamId, {
      status: "ended",
      endedAt: Date.now(),
      endedBy: userId,
    });
    console.log("[livestream.endStream] marked ended", {
      streamId: args.streamId,
      userId: stream.userId,
      title: stream.title,
    });

    // Save recording to library (even if still processing).
    // Recordings are always PUBLIC - only the live stream itself is PPV
    if (args.assetId) {
      const playbackUrl = args.playbackId
        ? `https://stream.mux.com/${args.playbackId}.m3u8`
        : undefined;

      // Check if the Mux webhook already created a record for this asset
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId!))
        .order("desc")
        .first();

      let videoId;

      if (existing) {
        // Webhook beat us — patch the existing record with livestream link
        videoId = existing._id;
        const updates: Record<string, unknown> = {};
        if (!existing.linkedLivestreamId) updates.linkedLivestreamId = args.streamId;
        if (!existing.uploadedBy) updates.uploadedBy = stream.startedBy || stream.userId;
        if (args.playbackId && !existing.playbackId) {
          updates.playbackId = args.playbackId;
          updates.playbackUrl = playbackUrl;
        }
        if (args.duration && (!existing.duration || args.duration > existing.duration)) {
          updates.duration = args.duration;
        }
        if (args.playbackId && existing.status !== "ready") {
          updates.status = "ready";
        }
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existing._id, updates);
        }
        console.log("[livestream.endStream] patched existing video record (webhook race avoided)", {
          videoId,
          assetId: args.assetId,
          updates,
        });
      } else {
        videoId = await ctx.db.insert("videos", {
          userId: ADMIN_LIBRARY_USER_ID,
          uploadedBy: stream.startedBy || stream.userId,
          title: stream.title,
          description: stream.description,
          provider: "mux",
          assetId: args.assetId,
          playbackId: args.playbackId,
          playbackUrl,
          duration: args.duration,
          status: args.playbackId ? "ready" : "processing",
          visibility: "public", // Recordings are always public
          viewCount: 0,
          heartCount: 0,
          linkedLivestreamId: args.streamId, // Link recording back to livestream
        });
        console.log("[livestream.endStream] inserted new video record", {
          videoId,
          assetId: args.assetId,
          playbackId: args.playbackId,
          playbackUrl,
          title: stream.title,
          status: args.playbackId ? "ready" : "processing",
          linkedLivestreamId: args.streamId,
        });
      }

      // Update livestream with reference to its recording
      await ctx.db.patch(args.streamId, {
        recordingVideoId: videoId,
      });
    } else {
      console.log("[livestream.endStream] no assetId provided; skipping video insert", {
        streamId: args.streamId,
      });
    }

    return args.streamId;
  },
});

// Update viewer count (any authenticated user can trigger this)
export const updateViewerCount = mutation({
  args: {
    streamId: v.id("livestreams"),
    viewerCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Only require authentication, not admin - this is called when users watch streams
    await getAuthenticatedUser(ctx);

    await ctx.db.patch(args.streamId, {
      viewerCount: args.viewerCount,
    });
  },
});

// Update stream title (admin only)
export const updateStreamTitle = mutation({
  args: {
    streamId: v.id("livestreams"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.patch(args.streamId, {
      title: args.title,
    });
  },
});

// Update stream price (admin only, in cents)
export const updateStreamPrice = mutation({
  args: {
    streamId: v.id("livestreams"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.patch(args.streamId, {
      price: args.price,
    });
  },
});

// Clear recordingVideoId from a livestream (used when deleting recording video)
export const clearRecordingVideoId = internalMutation({
  args: {
    livestreamId: v.id("livestreams"),
  },
  handler: async (ctx, args) => {
    const livestream = await ctx.db.get(args.livestreamId);
    if (!livestream) {
      return { cleared: false, reason: "Livestream not found" };
    }

    await ctx.db.patch(args.livestreamId, {
      recordingVideoId: undefined,
    });

    return { cleared: true };
  },
});
