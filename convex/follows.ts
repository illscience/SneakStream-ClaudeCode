import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Follow a user
export const followUser = mutation({
  args: {
    followerId: v.string(), // Current user's Clerk ID
    followingId: v.string(), // User being followed (e.g., "dj-sneak")
  },
  handler: async (ctx, args) => {
    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    if (existingFollow) {
      return { success: false, message: "Already following" };
    }

    await ctx.db.insert("follows", {
      followerId: args.followerId,
      followingId: args.followingId,
    });

    return { success: true, message: "Followed successfully" };
  },
});

// Unfollow a user
export const unfollowUser = mutation({
  args: {
    followerId: v.string(),
    followingId: v.string(),
  },
  handler: async (ctx, args) => {
    const follow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    if (!follow) {
      return { success: false, message: "Not following" };
    }

    await ctx.db.delete(follow._id);
    return { success: true, message: "Unfollowed successfully" };
  },
});

// Check if user is following another user
export const isFollowing = query({
  args: {
    followerId: v.string(),
    followingId: v.string(),
  },
  handler: async (ctx, args) => {
    const follow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    return follow !== null;
  },
});
