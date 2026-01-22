import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createPurchase = mutation({
  args: {
    buyerId: v.string(),
    videoId: v.id("videos"),
    amount: v.number(),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if purchase already exists for this session
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (existing) {
      return existing._id;
    }

    const purchaseId = await ctx.db.insert("purchases", {
      buyerId: args.buyerId,
      videoId: args.videoId,
      amount: args.amount,
      stripeSessionId: args.stripeSessionId,
      status: "pending",
      createdAt: Date.now(),
    });

    return purchaseId;
  },
});

export const completePurchase = mutation({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (!purchase) {
      throw new Error(`Purchase not found for session: ${args.stripeSessionId}`);
    }

    // Mark purchase as completed
    await ctx.db.patch(purchase._id, {
      status: "completed",
    });

    // Create entitlement for the user
    const existingEntitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_user_video", (q) =>
        q.eq("userId", purchase.buyerId).eq("videoId", purchase.videoId)
      )
      .first();

    if (!existingEntitlement) {
      await ctx.db.insert("entitlements", {
        userId: purchase.buyerId,
        videoId: purchase.videoId,
        grantedAt: Date.now(),
        grantedBy: "purchase",
      });
    }

    return purchase._id;
  },
});

export const failPurchase = mutation({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (!purchase) {
      return null;
    }

    await ctx.db.patch(purchase._id, {
      status: "failed",
    });

    return purchase._id;
  },
});

export const getPurchaseBySession = query({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();
  },
});

export const getUserPurchases = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const purchases = await ctx.db
      .query("purchases")
      .filter((q) =>
        q.and(
          q.eq(q.field("buyerId"), args.userId),
          q.eq(q.field("status"), "completed")
        )
      )
      .order("desc")
      .collect();

    // Fetch video info for each purchase
    const purchasesWithVideos = await Promise.all(
      purchases.map(async (purchase) => {
        const video = await ctx.db.get(purchase.videoId);
        return {
          ...purchase,
          videoTitle: video?.title ?? "Unknown Video",
          videoThumbnail: video?.thumbnailUrl,
        };
      })
    );

    return purchasesWithVideos;
  },
});
