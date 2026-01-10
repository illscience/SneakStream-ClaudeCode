import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

export const ADMIN_LIBRARY_USER_ID = "system/admin-library";
export const ADMIN_SHARED_CREDENTIALS_ID = "system/admin-shared";
export const SEED_ADMIN_EMAIL = "sneakthedj@gmail.com";

type AuthCtx = QueryCtx | MutationCtx;

async function isAdmin(ctx: AuthCtx, clerkId: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  return user?.isAdmin === true;
}

// TODO: Reinstate ctx.auth-based admin checks once Convex auth is configured.
export async function requireAdmin(ctx: AuthCtx, clerkId: string): Promise<string> {
  if (!clerkId) {
    throw new Error("Not authenticated");
  }
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
    clerkId: v.string(),
    key: v.string(),
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const clerkId = await requireAdmin(ctx, args.clerkId);

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
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await isAdmin(ctx, args.clerkId);
  },
});

// List all admins
export const getAdmins = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.clerkId);

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
    clerkId: v.string(),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.clerkId);

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
    clerkId: v.string(),
    targetClerkId: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.clerkId);

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
export const seedInitialAdmin = mutation({
  args: {
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
