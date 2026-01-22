import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createTip = mutation({
  args: {
    senderId: v.string(),
    amount: v.number(),
    message: v.optional(v.string()),
    emoji: v.optional(v.string()),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const tipId = await ctx.db.insert("tips", {
      senderId: args.senderId,
      amount: args.amount,
      message: args.message,
      emoji: args.emoji,
      videoId: args.videoId,
      livestreamId: args.livestreamId,
      stripeSessionId: args.stripeSessionId,
      status: "pending",
      createdAt: Date.now(),
    });
    return tipId;
  },
});

export const completeTip = mutation({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const tip = await ctx.db
      .query("tips")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (!tip) {
      throw new Error(`Tip not found for session: ${args.stripeSessionId}`);
    }

    await ctx.db.patch(tip._id, {
      status: "completed",
    });

    return tip._id;
  },
});

export const failTip = mutation({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const tip = await ctx.db
      .query("tips")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (!tip) {
      return null;
    }

    await ctx.db.patch(tip._id, {
      status: "failed",
    });

    return tip._id;
  },
});

export const getRecentTips = query({
  args: {
    limit: v.optional(v.number()),
    livestreamId: v.optional(v.id("livestreams")),
    videoId: v.optional(v.id("videos")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    let tipsQuery;

    if (args.livestreamId) {
      tipsQuery = ctx.db
        .query("tips")
        .withIndex("by_livestream", (q) => q.eq("livestreamId", args.livestreamId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .order("desc");
    } else if (args.videoId) {
      tipsQuery = ctx.db
        .query("tips")
        .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .order("desc");
    } else {
      tipsQuery = ctx.db
        .query("tips")
        .withIndex("by_status_created", (q) => q.eq("status", "completed"))
        .order("desc");
    }

    const tips = await tipsQuery.take(limit);

    // Fetch sender info for each tip
    const tipsWithSenders = await Promise.all(
      tips.map(async (tip) => {
        const sender = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", tip.senderId))
          .first();

        return {
          ...tip,
          senderName: sender?.alias ?? "Anonymous",
          senderAvatar: sender?.selectedAvatar ?? sender?.imageUrl,
        };
      })
    );

    return tipsWithSenders;
  },
});

export const getTipBySession = query({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tips")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();
  },
});
