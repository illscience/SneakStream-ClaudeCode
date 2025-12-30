import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new video entry
export const createVideo = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assetId: v.optional(v.string()),
    livepeerAssetId: v.optional(v.string()),
    uploadId: v.optional(v.string()),
    provider: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    visibility: v.string(),
  },
  handler: async (ctx, args) => {
    const { provider, assetId, livepeerAssetId, ...rest } = args;
    const resolvedProvider = provider || (livepeerAssetId ? "livepeer" : "mux");
    const resolvedAssetId = assetId || livepeerAssetId || undefined;

    if (resolvedAssetId) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", resolvedAssetId))
        .order("desc")
        .first();

      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("videos", {
      ...rest,
      assetId: resolvedAssetId,
      ...(livepeerAssetId ? { livepeerAssetId } : {}),
      provider: resolvedProvider,
      status: "processing",
      viewCount: 0,
    });
  },
});

// Upsert a Mux asset into the videos collection
export const upsertMuxAsset = mutation({
  args: {
    assetId: v.string(),
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    duration: v.optional(v.number()),
    status: v.optional(v.string()),
    visibility: v.optional(v.string()),
    liveStreamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("[videos.upsertMuxAsset] incoming", {
      assetId: args.assetId,
      userId: args.userId,
      title: args.title,
      status: args.status,
      playbackId: args.playbackId,
      liveStreamId: args.liveStreamId,
    });

    let existing = await ctx.db
      .query("videos")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .first();

    if (!existing && args.liveStreamId) {
      const placeholderAssetId = `pending:${args.liveStreamId}`;
      existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", placeholderAssetId))
        .order("desc")
        .first();

      if (existing) {
        console.log("[videos.upsertMuxAsset] matched placeholder by liveStreamId", {
          placeholderAssetId,
          existingId: existing._id,
        });
      }
    }

    const playbackUrl = args.playbackId
      ? `https://stream.mux.com/${args.playbackId}.m3u8`
      : undefined;

    if (existing) {
      const updates: Record<string, unknown> = {};

      if (args.title) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.playbackId) {
        updates.playbackId = args.playbackId;
        updates.playbackUrl = playbackUrl;
      }
      if (args.duration !== undefined) updates.duration = args.duration;
      if (args.status) updates.status = args.status;
      if (args.visibility) updates.visibility = args.visibility;
      if (args.assetId && existing.assetId !== args.assetId) {
        updates.assetId = args.assetId;
      }
      if (existing.provider !== "mux") updates.provider = "mux";

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        console.log("[videos.upsertMuxAsset] updated existing video", {
          videoId: existing._id,
          assetId: args.assetId,
          updates,
        });
      }

      return existing._id;
    }

    const newVideoId = await ctx.db.insert("videos", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      provider: "mux",
      assetId: args.assetId,
      playbackId: args.playbackId,
      playbackUrl,
      duration: args.duration,
      status: args.status || "processing",
      visibility: args.visibility || "public",
      viewCount: 0,
      heartCount: 0,
    });

    console.log("[videos.upsertMuxAsset] inserted new video", {
      videoId: newVideoId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      status: args.status || "processing",
    });

    return newVideoId;
  },
});

// Update video status
export const updateVideoStatus = mutation({
  args: {
    videoId: v.id("videos"),
    status: v.string(),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    progress: v.optional(v.number()),
    assetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { videoId, ...updates } = args;
    await ctx.db.patch(videoId, updates);
  },
});

// Get user's videos
export const getUserVideos = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get single video by ID
export const getVideo = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

// Get public videos (feed)
export const getPublicVideos = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("videos")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .take(limit);
  },
});

// Get videos from followed users
export const getFollowingVideos = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get list of users being followed
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    const followingIds = follows.map((f) => f.followingId);

    // Get videos from followed users
    const allVideos = await ctx.db
      .query("videos")
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .collect();

    return allVideos
      .filter((video) =>
        followingIds.includes(video.userId) &&
        (video.visibility === "public" || video.visibility === "followers")
      )
      .slice(0, limit);
  },
});

// Increment view count
export const incrementViewCount = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (video) {
      await ctx.db.patch(args.videoId, {
        viewCount: (video.viewCount || 0) + 1,
      });
    }
  },
});

// Increment heart count
export const incrementHeartCount = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (video) {
      await ctx.db.patch(args.videoId, {
        heartCount: (video.heartCount || 0) + 1,
      });
    }
  },
});

// Delete video
export const deleteVideo = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.videoId);
  },
});

// Update video details
export const updateVideo = mutation({
  args: {
    videoId: v.id("videos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { videoId, ...updates } = args;
    await ctx.db.patch(videoId, updates);
  },
});

// Set a video as the default video to play when no live stream is active
export const setDefaultVideo = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    // First, unset any existing default video
    const currentDefault = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .first();

    if (currentDefault) {
      await ctx.db.patch(currentDefault._id, { isDefault: false, startTime: undefined });
    }

    // Set the new default video with t0 (start timestamp)
    const startTime = Date.now();
    await ctx.db.patch(args.videoId, {
      isDefault: true,
      startTime: startTime
    });

    // Initialize synchronized playback state
    const existingState = await ctx.db
      .query("playbackState")
      .first();

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        videoId: args.videoId,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playbackState", {
        videoId: args.videoId,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    }
  },
});

// Unset the default video
export const unsetDefaultVideo = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, { isDefault: false });
  },
});

// Get the current default video
export const getDefaultVideo = query({
  handler: async (ctx) => {
    const defaultVideo = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .first();

    return defaultVideo;
  },
});
