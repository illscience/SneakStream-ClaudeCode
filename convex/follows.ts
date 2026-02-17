import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getOptionalAuthenticatedUser } from "./adminSettings";
import { createNotification } from "./notifications";

// Follow a user
export const followUser = mutation({
  args: {
    followingId: v.string(), // User being followed (e.g., "dj-sneak")
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's ID from JWT
    const followerId = await getAuthenticatedUser(ctx);

    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.followingId)
      )
      .first();

    if (existingFollow) {
      return { success: false, message: "Already following" };
    }

    await ctx.db.insert("follows", {
      followerId,
      followingId: args.followingId,
    });

    // Create follow notification for the user being followed
    const followerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", followerId))
      .first();

    await createNotification(ctx, {
      userId: args.followingId,
      type: "follow",
      fromUserId: followerId,
      fromUserName: followerUser?.alias ?? "Someone",
      fromAvatarUrl: followerUser?.selectedAvatar ?? followerUser?.imageUrl,
    });

    return { success: true, message: "Followed successfully" };
  },
});

// Unfollow a user
export const unfollowUser = mutation({
  args: {
    followingId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's ID from JWT
    const followerId = await getAuthenticatedUser(ctx);

    const follow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.followingId)
      )
      .first();

    if (!follow) {
      return { success: false, message: "Not following" };
    }

    await ctx.db.delete(follow._id);
    return { success: true, message: "Unfollowed successfully" };
  },
});

// Check if current user is following another user
export const isFollowing = query({
  args: {
    followingId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's ID from JWT
    const followerId = await getOptionalAuthenticatedUser(ctx);
    if (!followerId) {
      return false;
    }

    const follow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.followingId)
      )
      .first();

    return follow !== null;
  },
});
