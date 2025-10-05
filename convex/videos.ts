import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new video entry
export const createVideo = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    livepeerAssetId: v.string(),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    visibility: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("videos", {
      ...args,
      status: "processing",
      viewCount: 0,
    });
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
      await ctx.db.patch(currentDefault._id, { isDefault: false });
    }

    // Set the new default video
    await ctx.db.patch(args.videoId, { isDefault: true });

    // Initialize synchronized playback state
    const existingState = await ctx.db
      .query("playbackState")
      .first();

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        videoId: args.videoId,
        currentTime: 0,
        isPlaying: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playbackState", {
        videoId: args.videoId,
        currentTime: 0,
        isPlaying: true,
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
