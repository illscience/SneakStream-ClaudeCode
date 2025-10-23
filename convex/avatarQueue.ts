import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const QUEUE_TARGET_SIZE = 20;

/**
 * Add a pre-generated avatar to the queue
 */
export const enqueueAvatar = mutation({
  args: {
    imageUrl: v.string(),
    prompt: v.string(),
    seed: v.number(),
  },
  handler: async (ctx, args) => {
    const avatarId = await ctx.db.insert("avatarPool", {
      imageUrl: args.imageUrl,
      prompt: args.prompt,
      seed: args.seed,
      createdAt: Date.now(),
    });
    return avatarId;
  },
});


/**
 * Get total queue size
 */
export const getTotalCount = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("avatarPool").collect();
    return all.length;
  },
});

/**
 * Dequeue N avatars for immediate use
 * Deletes them immediately (no reservation needed)
 */
export const dequeueAvatars = mutation({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Get oldest N avatars
    const allAvatars = await ctx.db.query("avatarPool").collect();
    const toDequeue = allAvatars
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, args.count);

    const dequeued = [];
    for (const avatar of toDequeue) {
      dequeued.push({
        _id: avatar._id,
        imageUrl: avatar.imageUrl,
        prompt: avatar.prompt,
        seed: avatar.seed,
      });
      // Delete immediately - no reservation needed
      await ctx.db.delete(avatar._id);
    }

    return dequeued;
  },
});

/**
 * Get how many avatars need to be generated to reach target size
 */
export const getBackfillCount = query({
  handler: async (ctx) => {
    const total = await ctx.db.query("avatarPool").collect();
    const needed = Math.max(0, QUEUE_TARGET_SIZE - total.length);
    return needed;
  },
});

/**
 * Get N avatars without deleting (shared pool for multiple users)
 */
export const getAvatars = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Get oldest N avatars
    const allAvatars = await ctx.db.query("avatarPool").collect();
    const avatars = allAvatars
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, args.count);

    return avatars.map((avatar) => ({
      _id: avatar._id,
      imageUrl: avatar.imageUrl,
      prompt: avatar.prompt,
      seed: avatar.seed,
    }));
  },
});

/**
 * Delete a single avatar by ID (called when user releases to nightclub)
 * Silently handles if already deleted by another user
 */
export const deleteAvatar = mutation({
  args: {
    id: v.id("avatarPool"),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.delete(args.id);
    } catch (error) {
      // Already deleted by another user, ignore
      console.log(`[AVATAR_QUEUE] Avatar ${args.id} already deleted`);
    }
  },
});

