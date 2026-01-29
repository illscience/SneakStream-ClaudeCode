import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthenticatedUser } from "./adminSettings";

export const createTip = mutation({
  args: {
    amount: v.number(),
    message: v.optional(v.string()),
    emoji: v.optional(v.string()),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
    stripeSessionId: v.string(),
    // Optional: passed from authenticated API routes
    senderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Get sender ID from auth, or use server-provided ID
    // Server-provided ID is trusted because API routes authenticate via Clerk
    let senderId: string;
    const authUser = await ctx.auth.getUserIdentity();
    if (authUser) {
      senderId = authUser.subject;
    } else if (args.senderId) {
      // Server-side call from authenticated API route
      senderId = args.senderId;
    } else {
      throw new Error("Not authenticated");
    }

    const tipId = await ctx.db.insert("tips", {
      senderId,
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

// Called from Stripe webhook handler - security via session ID lookup
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

    // Get sender info for the celebration message
    const sender = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", tip.senderId))
      .first();

    const senderName = sender?.alias ?? "Someone";
    const senderAvatar = sender?.selectedAvatar ?? sender?.imageUrl;

    // Format the tip amount
    const amountFormatted = `$${(tip.amount / 100).toFixed(2)}`;

    // Create the celebration message body with special format
    // Format: :tip:{amount}:{emoji}:{message}
    const tipData = JSON.stringify({
      type: "tip",
      amount: tip.amount,
      emoji: tip.emoji,
      message: tip.message,
    });
    const messageBody = `:tip:${tipData}`;

    // Post celebration message to chat
    await ctx.db.insert("messages", {
      user: tip.senderId,
      userId: tip.senderId,
      userName: senderName,
      avatarUrl: senderAvatar,
      body: messageBody,
    });

    return tip._id;
  },
});

// Called from Stripe webhook handler - security via session ID lookup
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
