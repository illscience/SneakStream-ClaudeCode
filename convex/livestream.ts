import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ADMIN_LIBRARY_USER_ID } from "./adminSettings";

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

// Start a new stream (end any existing active streams first)
export const startStream = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
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
    const streamId = await ctx.db.insert("livestreams", {
      userId: args.userId,
      userName: args.userName,
      startedBy: args.userId,
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
      price: 999, // Default price $9.99
    });

    return streamId;
  },
});

// End a stream and optionally save recording to library
export const endStream = mutation({
  args: {
    streamId: v.id("livestreams"),
    userId: v.optional(v.string()),
    assetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
      endedBy: args.userId ?? stream.startedBy ?? stream.userId,
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

      const videoId = await ctx.db.insert("videos", {
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

      // Update livestream with reference to its recording
      await ctx.db.patch(args.streamId, {
        recordingVideoId: videoId,
      });

      console.log("[livestream.endStream] inserted video record", {
        videoId,
        assetId: args.assetId,
        playbackId: args.playbackId,
        playbackUrl,
        title: stream.title,
        status: args.playbackId ? "ready" : "processing",
        linkedLivestreamId: args.streamId,
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

// Update viewer count
export const updateViewerCount = mutation({
  args: {
    streamId: v.id("livestreams"),
    viewerCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.streamId, {
      viewerCount: args.viewerCount,
    });
  },
});

// Update stream title
export const updateStreamTitle = mutation({
  args: {
    streamId: v.id("livestreams"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.streamId, {
      title: args.title,
    });
  },
});
