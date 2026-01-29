import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthenticatedUser, requireAdmin } from "./adminSettings";

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
    alias: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get the user's clerkId from JWT - users can only update their own profile
    const clerkId = await getAuthenticatedUser(ctx);

    const normalizedEmail = args.email?.toLowerCase();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        alias: args.alias,
        email: normalizedEmail,
        imageUrl: args.imageUrl,
      });
      return existingUser._id;
    } else {
      return await ctx.db.insert("users", {
        clerkId,
        alias: args.alias,
        email: normalizedEmail,
        imageUrl: args.imageUrl,
      });
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

// Update user's selected avatar
export const updateSelectedAvatar = mutation({
  args: {
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get the user's clerkId from JWT - users can only update their own avatar
    const clerkId = await getAuthenticatedUser(ctx);

    let imageUrl: string | undefined = args.avatarUrl ?? undefined;

    if (args.avatarStorageId) {
      const resolved = await ctx.storage.getUrl(args.avatarStorageId);
      imageUrl = resolved ?? imageUrl;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) {
      const newUserId = await ctx.db.insert("users", {
        clerkId,
        alias: "User",
        email: undefined,
        imageUrl: imageUrl ?? undefined,
        selectedAvatar: imageUrl ?? undefined,
      });
      return { userId: newUserId, imageUrl };
    }

    await ctx.db.patch(user._id, {
      selectedAvatar: imageUrl ?? undefined,
      imageUrl: imageUrl ?? user.imageUrl,
    });

    return { userId: user._id, imageUrl };
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // SECURITY: Require authentication to generate upload URL
    await getAuthenticatedUser(ctx);

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const searchUsersByAlias = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) =>
        user.alias.toLowerCase().includes(args.searchTerm.toLowerCase())
      )
      .slice(0, 10);
  },
});

// Admin-only migration: backfill users from messages
export const backfillUsersFromMessages = mutation({
  args: {},
  handler: async (ctx) => {
    // SECURITY: Only admins can run migrations
    await requireAdmin(ctx);

    const messages = await ctx.db.query("messages").collect();
    const seen = new Set<string>();
    let created = 0;

    for (const message of messages) {
      const clerkId = message.userId;
      if (!clerkId || seen.has(clerkId)) continue;
      seen.add(clerkId);

      const existing = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .first();

      if (existing) continue;

      const alias = message.userName || message.user || "User";
      await ctx.db.insert("users", {
        clerkId,
        alias,
        email: undefined,
        imageUrl: message.avatarUrl ?? undefined,
        selectedAvatar: message.avatarUrl ?? undefined,
      });
      created += 1;
    }

    return { created };
  },
});
