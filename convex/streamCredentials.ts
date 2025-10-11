import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get or create persistent stream credentials for a user
export const getOrCreateCredentials = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Check if user already has credentials
    const existing = await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return existing;
  },
});

// Save new stream credentials
export const saveCredentials = mutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    streamId: v.string(),
    streamKey: v.string(),
    playbackId: v.string(),
    playbackUrl: v.string(),
    rtmpIngestUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if credentials already exist
    const existing = await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        streamId: args.streamId,
        streamKey: args.streamKey,
        playbackId: args.playbackId,
        playbackUrl: args.playbackUrl,
        rtmpIngestUrl: args.rtmpIngestUrl,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("streamCredentials", {
      userId: args.userId,
      provider: args.provider,
      streamId: args.streamId,
      streamKey: args.streamKey,
      playbackId: args.playbackId,
      playbackUrl: args.playbackUrl,
      rtmpIngestUrl: args.rtmpIngestUrl,
      createdAt: Date.now(),
    });
  },
});
