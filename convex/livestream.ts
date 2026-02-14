import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { ADMIN_LIBRARY_USER_ID, requireAdmin, getAuthenticatedUser } from "./adminSettings";
import { logConvexTrace } from "./debugTrace";
import { upsertMuxRecording } from "./recordingIngest";

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
  args: {
    streamId: v.string(),
    recordingCreatedAt: v.optional(v.number()),
    recordingObservedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("livestreams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .collect();

    if (streams.length === 0) {
      return null;
    }

    const observedAt = args.recordingObservedAt ?? Date.now();
    const recordedAt = args.recordingCreatedAt ?? observedAt;
    const candidateStreams = streams.filter((stream) => {
      const windowStart = stream.startedAt - 10 * 60 * 1000;
      const windowEnd = (stream.endedAt ?? observedAt + 30 * 60 * 1000) + 30 * 60 * 1000;
      return recordedAt >= windowStart && recordedAt <= windowEnd;
    });

    if (candidateStreams.length === 1) {
      return candidateStreams[0];
    }

    if (candidateStreams.length > 1) {
      const unlinkedCandidates = candidateStreams.filter((stream) => !stream.recordingVideoId);
      const pool = unlinkedCandidates.length > 0 ? unlinkedCandidates : candidateStreams;
      return pool.sort((a, b) => b.startedAt - a.startedAt)[0];
    }

    if (streams.length === 1) {
      return streams[0];
    }

    const recentActive = streams.filter(
      (stream) => stream.status === "active" && observedAt - stream.startedAt < 3 * 60 * 60 * 1000
    );
    if (recentActive.length === 1) {
      return recentActive[0];
    }

    return null;
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
      logConvexTrace("livestream.updateStartedAt.not_found", {
        streamId: args.streamId,
      });
      return null;
    }

    // Only update if stream is active (don't update ended streams)
    if (stream.status !== "active") {
      console.log("[updateStreamStartedAt] Stream not active, skipping:", args.streamId);
      logConvexTrace("livestream.updateStartedAt.skipped_not_active", {
        streamId: args.streamId,
        livestreamId: stream._id,
        status: stream.status,
      });
      return null;
    }

    // Only update startedAt ONCE - on the first active event
    // This prevents reconnects from resetting the timeline
    if (stream.startedAtFromWebhook) {
      console.log("[updateStreamStartedAt] Already updated from webhook, skipping:", args.streamId);
      logConvexTrace("livestream.updateStartedAt.skipped_already_set", {
        streamId: args.streamId,
        livestreamId: stream._id,
        currentStartedAt: stream.startedAt,
      });
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
    logConvexTrace("livestream.updateStartedAt.updated", {
      streamId: args.streamId,
      livestreamId: stream._id,
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
      logConvexTrace("livestream.startStream.ended_prior", {
        endedLivestreamId: stream._id,
        endedStreamId: stream.streamId,
        endedTitle: stream.title,
        endedRecordingVideoId: stream.recordingVideoId ?? null,
      });
    }

    logConvexTrace("livestream.startStream.creating", {
      userId,
      userName,
      title: args.title,
      provider: args.provider || "mux",
      streamId: args.streamId,
      priorActiveCount: existingActiveStreams.length,
    });

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

    logConvexTrace("livestream.startStream.created", {
      newLivestreamId: newStreamId,
      userId,
      title: args.title,
      streamId: args.streamId,
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
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can end streams
    const userId = await requireAdmin(ctx);

    logConvexTrace("livestream.endStream.called", {
      traceId: args.traceId,
      streamId: args.streamId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      duration: args.duration,
      actingUserId: userId,
    });
    console.log("[livestream.endStream] called", {
      streamId: args.streamId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      duration: args.duration,
    });

    const stream = await ctx.db.get(args.streamId);
    if (!stream) {
      logConvexTrace("livestream.endStream.stream_not_found", {
        traceId: args.traceId,
        streamId: args.streamId,
      });
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
    logConvexTrace("livestream.endStream.marked_ended", {
      traceId: args.traceId,
      streamId: args.streamId,
      userId: stream.userId,
      title: stream.title,
      currentStatus: stream.status,
    });
    console.log("[livestream.endStream] marked ended", {
      streamId: args.streamId,
      userId: stream.userId,
      title: stream.title,
    });

    // Save recording to library via idempotent upsert by assetId.
    // This prevents duplicate rows when webhook and end-stream both ingest.
    if (args.assetId) {
      logConvexTrace("livestream.endStream.upsert_intent", {
        traceId: args.traceId,
        streamId: args.streamId,
        assetId: args.assetId,
        playbackId: args.playbackId,
        status: args.playbackId ? "ready" : "processing",
      });
      const result = await upsertMuxRecording(ctx, {
        source: "end_stream",
        traceId: args.traceId,
        assetId: args.assetId,
        userId: ADMIN_LIBRARY_USER_ID,
        uploadedBy: stream.startedBy || stream.userId,
        title: stream.title,
        description: stream.description,
        playbackId: args.playbackId,
        duration: args.duration,
        status: args.playbackId ? "ready" : "processing",
        visibility: "public",
        liveStreamId: stream.streamId,
        linkedLivestreamId: args.streamId,
      });

      logConvexTrace("livestream.endStream.upsert_result", {
        traceId: args.traceId,
        streamId: args.streamId,
        videoId: result.videoId,
        assetId: args.assetId,
        playbackId: args.playbackId,
        action: result.action,
        linkStatus: result.linkStatus,
      });

      console.log("[livestream.endStream] upserted recording video", {
        videoId: result.videoId,
        assetId: args.assetId,
        playbackId: args.playbackId,
        title: stream.title,
        status: args.playbackId ? "ready" : "processing",
        linkedLivestreamId: args.streamId,
        action: result.action,
        linkStatus: result.linkStatus,
      });
    } else {
      logConvexTrace("livestream.endStream.no_asset", {
        traceId: args.traceId,
        streamId: args.streamId,
      });
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
