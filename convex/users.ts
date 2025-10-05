import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DJ_SNEAK_USER: Doc<"users"> = {
  _id: "dj-sneak" as Id<"users">,
  _creationTime: 0,
  clerkId: "dj-sneak",
  alias: "DJ SNEAK",
  email: undefined,
  imageUrl: undefined,
};

// Create or update user profile
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    alias: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        alias: args.alias,
        email: args.email,
        imageUrl: args.imageUrl,
      });
      return existingUser._id;
    } else {
      return await ctx.db.insert("users", args);
    }
  },
});

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Get user's followers (returns user objects with aliases)
export const getFollowers = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.clerkId))
      .collect();

    const followers = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", follow.followerId))
          .first();
        return user;
      })
    );

    return followers.filter((user) => user !== null);
  },
});

// Get who the user is following
export const getFollowing = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.clerkId))
      .collect();

    const following = await Promise.all(
      follows.map(async (follow) => {
        // Try to get the user from the users table
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", follow.followingId))
          .first();

        // If it's a special ID like "dj-sneak", return a mock user object
        if (!user && follow.followingId === "dj-sneak") {
          return DJ_SNEAK_USER;
        }

        return user;
      })
    );

    return following.filter((user) => user !== null);
  },
});

// Get follower count
export const getFollowerCount = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.clerkId))
      .collect();
    return follows.length;
  },
});

// Get following count
export const getFollowingCount = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.clerkId))
      .collect();
    return follows.length;
  },
});
