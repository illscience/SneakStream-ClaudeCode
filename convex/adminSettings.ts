import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

export const ADMIN_LIBRARY_USER_ID = "system/admin-library";
export const ADMIN_SHARED_CREDENTIALS_ID = "system/admin-shared";
export const SEED_ADMIN_EMAIL = "sneakthedj@gmail.com";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Gets the authenticated user's Clerk ID from the JWT token.
 * Throws an error if not authenticated.
 */
export async function getAuthenticatedUser(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  // The 'subject' claim contains the Clerk user ID
  return identity.subject;
}

/**
 * Gets the authenticated user's Clerk ID, or null if not authenticated.
 * Use this for optional authentication scenarios.
 */
export async function getOptionalAuthenticatedUser(ctx: AuthCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity.subject;
}

async function isAdmin(ctx: AuthCtx, clerkId: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  return user?.isAdmin === true;
}

/**
 * Verifies the user is authenticated and is an admin.
 * Returns the authenticated user's Clerk ID.
 */
export async function requireAdmin(ctx: AuthCtx): Promise<string> {
  const clerkId = await getAuthenticatedUser(ctx);
  if (!(await isAdmin(ctx, clerkId))) {
    throw new Error("Unauthorized: Admin access required");
  }
  return clerkId;
}

// Get a setting by key
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    // Default to true if setting doesn't exist
    return setting?.value ?? true;
  },
});

// Update a setting (admin only)
export const updateSetting = mutation({
  args: {
    key: v.string(),
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const clerkId = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: clerkId,
      });
    } else {
      await ctx.db.insert("adminSettings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: clerkId,
      });
    }
  },
});

// Check if current user is admin
export const checkIsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const clerkId = await getOptionalAuthenticatedUser(ctx);
    if (!clerkId) {
      return false;
    }
    return await isAdmin(ctx, clerkId);
  },
});

// List all admins
export const getAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const admins = await ctx.db
      .query("users")
      .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
      .collect();

    return admins.map((admin) => ({
      clerkId: admin.clerkId,
      alias: admin.alias,
      email: admin.email,
      imageUrl: admin.selectedAvatar ?? admin.imageUrl,
      isAdmin: admin.isAdmin ?? false,
    }));
  },
});

// Search users for admin management (simple, server-filtered)
export const searchUsersForAdmin = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const term = args.searchTerm.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();

    const matches = term.length === 0
      ? users
      : users.filter((user) => {
          const aliasMatch = user.alias.toLowerCase().includes(term);
          const emailMatch = user.email?.toLowerCase().includes(term) ?? false;
          return aliasMatch || emailMatch;
        });

    return matches.slice(0, 20).map((user) => ({
      clerkId: user.clerkId,
      alias: user.alias,
      email: user.email,
      imageUrl: user.selectedAvatar ?? user.imageUrl,
      isAdmin: user.isAdmin ?? false,
    }));
  },
});

// Update admin status for a user
export const setAdminStatus = mutation({
  args: {
    targetClerkId: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.targetClerkId))
      .first();

    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.isAdmin && !args.isAdmin) {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
        .collect();

      if (admins.length <= 1) {
        throw new Error("Cannot remove the last admin");
      }
    }

    await ctx.db.patch(targetUser._id, { isAdmin: args.isAdmin });
  },
});

// One-time migration: seed initial admin by email if no admins exist
// Protected by requiring a secret and only works when no admins exist
export const seedInitialAdmin = mutation({
  args: {
    email: v.optional(v.string()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the secret matches the environment variable
    const expectedSecret = process.env.SEED_ADMIN_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Invalid seed secret");
    }

    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
      .first();

    if (existingAdmin) {
      return { seeded: false, reason: "Admin already exists" };
    }

    const targetEmail = (args.email ?? SEED_ADMIN_EMAIL).toLowerCase();
    const users = await ctx.db.query("users").collect();
    const targetUser = users.find(
      (user) => user.email?.toLowerCase() === targetEmail
    );

    if (!targetUser) {
      return { seeded: false, reason: "User not found for seed email" };
    }

    await ctx.db.patch(targetUser._id, { isAdmin: true });
    return { seeded: true, clerkId: targetUser.clerkId };
  },
});
