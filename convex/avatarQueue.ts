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
    const avatarId = await ctx.db.insert("avatarQueueV2", {
      imageUrl: args.imageUrl,
      prompt: args.prompt,
      seed: args.seed,
      createdAt: Date.now(),
      isReserved: false,
    });
    return avatarId;
  },
});

/**
 * Get count of available (non-reserved) avatars in queue
 */
export const getAvailableCount = query({
  handler: async (ctx) => {
    const allAvatars = await ctx.db.query("avatarQueueV2").collect();
    const available = allAvatars.filter((a) => !a.isReserved); // undefined = false
    return available.length;
  },
});

/**
 * Get total queue size (including reserved)
 */
export const getTotalCount = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("avatarQueueV2").collect();
    return all.length;
  },
});

/**
 * Dequeue N avatars for immediate use
 * Returns array of avatar data
 */
export const dequeueAvatars = mutation({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // Query all avatars and filter for non-reserved ones (treating undefined as false)
    const allAvatars = await ctx.db.query("avatarQueueV2").collect();
    const available = allAvatars
      .filter((a) => !a.isReserved) // undefined is falsy, so !undefined = true
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, args.count);

    const dequeued = [];
    for (const avatar of available) {
      // Mark as reserved so others don't get it
      await ctx.db.patch(avatar._id, { isReserved: true });
      dequeued.push({
        _id: avatar._id,
        imageUrl: avatar.imageUrl,
        prompt: avatar.prompt,
        seed: avatar.seed,
      });
    }

    return dequeued;
  },
});

/**
 * Remove a reserved avatar from the queue after it's been activated
 */
export const removeFromQueue = mutation({
  args: {
    queueId: v.id("avatarQueueV2"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.queueId);
  },
});

/**
 * Clear all reserved avatars older than 5 minutes (cleanup for failed activations)
 */
export const cleanupStaleReservations = mutation({
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const allAvatars = await ctx.db.query("avatarQueueV2").collect();
    const stale = allAvatars.filter(
      (a) => a.isReserved === true && a.createdAt < fiveMinutesAgo
    );

    for (const avatar of stale) {
      await ctx.db.delete(avatar._id);
    }

    return stale.length;
  },
});

/**
 * Get how many avatars need to be generated to reach target size
 */
export const getBackfillCount = query({
  handler: async (ctx) => {
    const total = await ctx.db.query("avatarQueueV2").collect();
    const needed = Math.max(0, QUEUE_TARGET_SIZE - total.length);
    return needed;
  },
});

