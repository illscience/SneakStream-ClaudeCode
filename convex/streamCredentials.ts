import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ADMIN_SHARED_CREDENTIALS_ID } from "./adminSettings";

// Get shared stream credentials (admin only)
export const getSharedCredentials = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_SHARED_CREDENTIALS_ID))
      .first();
  },
});

// Save shared stream credentials (admin only)
export const saveSharedCredentials = mutation({
  args: {
    provider: v.string(),
    streamId: v.string(),
    streamKey: v.string(),
    playbackId: v.string(),
    playbackUrl: v.string(),
    rtmpIngestUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_SHARED_CREDENTIALS_ID))
      .first();

    if (existing) {
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

    return await ctx.db.insert("streamCredentials", {
      userId: ADMIN_SHARED_CREDENTIALS_ID,
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

// One-time migration: Convert user credentials to shared credentials
export const migrateToSharedCredentials = mutation({
  args: {
    sourceUserId: v.string(),
    deleteOldRecord: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userCreds = await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", args.sourceUserId))
      .first();

    if (!userCreds) {
      return { migrated: false, reason: "No credentials found for source user" };
    }

    const existingShared = await ctx.db
      .query("streamCredentials")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_SHARED_CREDENTIALS_ID))
      .first();

    if (existingShared) {
      return { migrated: false, reason: "Shared credentials already exist" };
    }

    await ctx.db.insert("streamCredentials", {
      userId: ADMIN_SHARED_CREDENTIALS_ID,
      provider: userCreds.provider,
      streamId: userCreds.streamId,
      streamKey: userCreds.streamKey,
      playbackId: userCreds.playbackId,
      playbackUrl: userCreds.playbackUrl,
      rtmpIngestUrl: userCreds.rtmpIngestUrl,
      createdAt: Date.now(),
    });

    if (args.deleteOldRecord) {
      await ctx.db.delete(userCreds._id);
    }

    return { migrated: true, deletedOld: args.deleteOldRecord ?? false };
  },
});
