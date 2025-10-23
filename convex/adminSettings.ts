import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

const ADMIN_EMAIL = "illscience@gmail.com";

// Helper to check if user is admin
async function isAdmin(ctx: QueryCtx, clerkId: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();
  
  return user?.email === ADMIN_EMAIL;
}

// Get a setting by key
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    // Default to true if setting doesn't exist (show nightclub by default)
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
    // Verify admin access
    if (!(await isAdmin(ctx, args.clerkId))) {
      throw new Error("Unauthorized: Admin access required");
    }

    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.clerkId,
      });
    } else {
      await ctx.db.insert("adminSettings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.clerkId,
      });
    }
  },
});

// Check if user is admin
export const checkIsAdmin = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await isAdmin(ctx, args.clerkId);
  },
});

