import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminSettings";

// Update the playback state (admin only)
export const updatePlaybackState = mutation({
  args: {
    videoId: v.id("videos"),
    currentTime: v.number(),
    isPlaying: v.boolean(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can control playback state
    await requireAdmin(ctx);
    // Get existing playback state
    const existingState = await ctx.db
      .query("playbackState")
      .first();

    if (existingState) {
      // Update existing state
      await ctx.db.patch(existingState._id, {
        videoId: args.videoId,
        currentTime: args.currentTime,
        isPlaying: args.isPlaying,
        updatedAt: Date.now(),
      });
    } else {
      // Create new state
      await ctx.db.insert("playbackState", {
        videoId: args.videoId,
        currentTime: args.currentTime,
        isPlaying: args.isPlaying,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get the current playback state (called by all clients)
export const getPlaybackState = query({
  handler: async (ctx) => {
    const state = await ctx.db
      .query("playbackState")
      .first();

    if (!state) {
      return null;
    }

    // Get the video details
    const video = await ctx.db.get(state.videoId);

    return {
      ...state,
      video,
    };
  },
});

// Initialize playback state when a video is set as default (admin only)
export const initializePlaybackState = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can initialize playback state
    await requireAdmin(ctx);

    const existingState = await ctx.db
      .query("playbackState")
      .first();

    if (existingState) {
      // Update to new video, start from beginning
      await ctx.db.patch(existingState._id, {
        videoId: args.videoId,
        currentTime: 0,
        isPlaying: true,
        updatedAt: Date.now(),
      });
    } else {
      // Create new state
      await ctx.db.insert("playbackState", {
        videoId: args.videoId,
        currentTime: 0,
        isPlaying: true,
        updatedAt: Date.now(),
      });
    }
  },
});
