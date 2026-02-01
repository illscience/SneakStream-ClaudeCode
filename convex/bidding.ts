import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Initial bid amount in cents ($10)
const INITIAL_BID_AMOUNT = 1000;
// Bid increment in cents ($5)
const BID_INCREMENT = 500;
// Bidding countdown duration in milliseconds (60 seconds) - resets on each new bid
const BIDDING_COUNTDOWN_MS = 60 * 1000;

// Open a new bidding session for a livestream (admin only)
export const openBidding = mutation({
  args: {
    livestreamId: v.id("livestreams"),
    videoTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for admin or server-side call
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      if (!user?.isAdmin) {
        throw new Error("Only admins can open bidding");
      }
    }

    // Check if there's already an active session for this livestream
    const existingSession = await ctx.db
      .query("biddingSessions")
      .withIndex("by_livestream", (q) => q.eq("livestreamId", args.livestreamId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "payment_pending")
        )
      )
      .first();

    if (existingSession) {
      throw new Error("There is already an active bidding session for this livestream");
    }

    const sessionId = await ctx.db.insert("biddingSessions", {
      livestreamId: args.livestreamId,
      videoTimestamp: args.videoTimestamp,
      openedAt: Date.now(),
      status: "open",
    });

    return sessionId;
  },
});

// Close bidding without a sale (admin only)
export const closeBidding = mutation({
  args: {
    sessionId: v.id("biddingSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      if (!user?.isAdmin) {
        throw new Error("Only admins can close bidding");
      }
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Mark all active bids as expired
    const activeBids = await ctx.db
      .query("bids")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    for (const bid of activeBids) {
      await ctx.db.patch(bid._id, { status: "expired" });
    }

    await ctx.db.patch(args.sessionId, { status: "expired" });
    return args.sessionId;
  },
});

// Place or raise a bid (requires auth)
export const placeBid = mutation({
  args: {
    sessionId: v.id("biddingSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be signed in to bid");
    }

    const bidderId = identity.subject;

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status !== "open") {
      throw new Error("Bidding is not open for this session");
    }

    // Get bidder info for chat message
    const bidderUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", bidderId))
      .first();
    const bidderName = bidderUser?.alias ?? "Someone";
    const bidderAvatar = bidderUser?.selectedAvatar ?? bidderUser?.imageUrl;

    // Get current highest bid
    const currentHighestBid = await ctx.db
      .query("bids")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .first();

    // Calculate bid amount
    let bidAmount: number;
    let isOutbid = false;
    let outbidUserId: string | null = null;

    if (!currentHighestBid) {
      // First bid is $10
      bidAmount = INITIAL_BID_AMOUNT;
    } else {
      // Check if same user is trying to bid again while holding
      if (currentHighestBid.bidderId === bidderId) {
        throw new Error("You are already the current holder");
      }
      // Outbid by $5
      bidAmount = currentHighestBid.amount + BID_INCREMENT;
      isOutbid = true;
      outbidUserId = currentHighestBid.bidderId;
      // Mark previous bid as outbid
      await ctx.db.patch(currentHighestBid._id, { status: "outbid" });
    }

    // Create new bid
    const bidId = await ctx.db.insert("bids", {
      sessionId: args.sessionId,
      bidderId,
      amount: bidAmount,
      createdAt: Date.now(),
      status: "active",
    });

    // Start/reset the bidding countdown - each bid resets the timer
    await ctx.db.patch(args.sessionId, {
      biddingEndsAt: Date.now() + BIDDING_COUNTDOWN_MS,
    });

    // Post chat message for bid
    const bidData = JSON.stringify({
      type: isOutbid ? "outbid" : "bid",
      amount: bidAmount,
      outbidUserId: outbidUserId,
    });
    const messageBody = `:auction:${bidData}`;

    await ctx.db.insert("messages", {
      user: bidderId,
      userId: bidderId,
      userName: bidderName,
      avatarUrl: bidderAvatar,
      body: messageBody,
    });

    return { bidId, amount: bidAmount };
  },
});

// Get current session for a livestream
export const getCurrentSession = query({
  args: {
    livestreamId: v.id("livestreams"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("biddingSessions")
      .withIndex("by_livestream", (q) => q.eq("livestreamId", args.livestreamId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "payment_pending")
        )
      )
      .first();

    if (!session) {
      return null;
    }

    // Get current highest bid - check for "active" (during bidding) or "won" (payment pending)
    let currentBid = await ctx.db
      .query("bids")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", session._id).eq("status", "active")
      )
      .first();

    // If no active bid and session is payment_pending, look for the won bid
    if (!currentBid && session.status === "payment_pending") {
      currentBid = await ctx.db
        .query("bids")
        .withIndex("by_session_status", (q) =>
          q.eq("sessionId", session._id).eq("status", "won")
        )
        .first();
    }

    let holder = null;
    if (currentBid) {
      const holderUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", currentBid.bidderId))
        .first();
      holder = {
        clerkId: currentBid.bidderId,
        alias: holderUser?.alias ?? "Anonymous",
        avatarUrl: holderUser?.selectedAvatar ?? holderUser?.imageUrl,
      };
    }

    return {
      ...session,
      currentBid: currentBid
        ? {
            amount: currentBid.amount,
            bidderId: currentBid.bidderId,
          }
        : null,
      holder,
      nextBidAmount: currentBid
        ? currentBid.amount + BID_INCREMENT
        : INITIAL_BID_AMOUNT,
    };
  },
});

// Get user's crate (purchased track moments)
export const getUserCrate = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Allow querying by userId or use authenticated user
    let userId = args.userId;
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return [];
      }
      userId = identity.subject;
    }

    const crateItems = await ctx.db
      .query("crate")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();

    // Fetch livestream info for each crate item
    const itemsWithDetails = await Promise.all(
      crateItems.map(async (item) => {
        const livestream = await ctx.db.get(item.livestreamId);
        return {
          ...item,
          livestreamTitle: livestream?.title ?? "Unknown Stream",
          livestreamStartedAt: livestream?.startedAt,
        };
      })
    );

    return itemsWithDetails;
  },
});

// Internal mutation for sealing countdown expiry
export const processSealingExpiry = internalMutation({
  args: {
    sessionId: v.id("biddingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "sealing") {
      return;
    }

    if (session.sealingEndsAt && Date.now() >= session.sealingEndsAt) {
      // Get winning bid
      const winningBid = await ctx.db
        .query("bids")
        .withIndex("by_session_status", (q) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .first();

      if (winningBid) {
        // Mark bid as won
        await ctx.db.patch(winningBid._id, { status: "won" });
        // Move session to payment pending (no deadline - winner can pay anytime)
        await ctx.db.patch(args.sessionId, {
          status: "payment_pending",
        });
      } else {
        // No bids, expire session
        await ctx.db.patch(args.sessionId, { status: "expired" });
      }
    }
  },
});

// Internal mutation for payment window expiry
export const processPaymentExpiry = internalMutation({
  args: {
    sessionId: v.id("biddingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "payment_pending") {
      return;
    }

    if (session.paymentDeadline && Date.now() >= session.paymentDeadline) {
      // Mark winning bid as expired
      const wonBid = await ctx.db
        .query("bids")
        .withIndex("by_session_status", (q) =>
          q.eq("sessionId", args.sessionId).eq("status", "won")
        )
        .first();

      if (wonBid) {
        await ctx.db.patch(wonBid._id, { status: "expired" });
      }

      // Expire the session - record is lost
      await ctx.db.patch(args.sessionId, { status: "expired" });
    }
  },
});

// Complete a crate purchase (called from Stripe webhook)
export const completeCratePurchase = mutation({
  args: {
    stripeSessionId: v.string(),
    sessionId: v.id("biddingSessions"),
    bidderId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Bidding session not found");
    }

    // Verify the bidder won
    const wonBid = await ctx.db
      .query("bids")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "won")
      )
      .first();

    if (!wonBid || wonBid.bidderId !== args.bidderId) {
      throw new Error("Invalid winner for this session");
    }

    // Add to crate
    const crateId = await ctx.db.insert("crate", {
      ownerId: args.bidderId,
      livestreamId: session.livestreamId,
      videoTimestamp: session.videoTimestamp,
      purchaseAmount: args.amount,
      stripeSessionId: args.stripeSessionId,
      purchasedAt: Date.now(),
    });

    // Mark session as sold
    await ctx.db.patch(args.sessionId, { status: "sold" });

    // Get buyer info for chat message
    const buyer = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.bidderId))
      .first();

    const buyerName = buyer?.alias ?? "Someone";
    const buyerAvatar = buyer?.selectedAvatar ?? buyer?.imageUrl;

    // Post celebration message to chat
    const crateData = JSON.stringify({
      type: "crate_purchase",
      amount: args.amount,
    });
    const messageBody = `:crate_purchase:${crateData}`;

    await ctx.db.insert("messages", {
      user: args.bidderId,
      userId: args.bidderId,
      userName: buyerName,
      avatarUrl: buyerAvatar,
      body: messageBody,
    });

    return crateId;
  },
});

// Fail a crate purchase (called from Stripe webhook or timeout)
export const failCratePurchase = mutation({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the crate entry if it exists
    const crateEntry = await ctx.db
      .query("crate")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    // Crate entry shouldn't exist if payment failed, but clean up if it does
    if (crateEntry) {
      await ctx.db.delete(crateEntry._id);
    }

    return null;
  },
});

// Get session by Stripe session ID (for webhook processing)
export const getSessionByStripeId = query({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up crate by stripe session to find the bidding session
    const crate = await ctx.db
      .query("crate")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    return crate;
  },
});

// Check all active sessions for expiry (called by cron)
export const checkBiddingExpiry = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Check open sessions with expired bidding countdown
    const openSessions = await ctx.db
      .query("biddingSessions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    for (const session of openSessions) {
      // Only process if countdown has started and expired
      if (session.biddingEndsAt && now >= session.biddingEndsAt) {
        // Get winning bid
        const winningBid = await ctx.db
          .query("bids")
          .withIndex("by_session_status", (q) =>
            q.eq("sessionId", session._id).eq("status", "active")
          )
          .first();

        if (winningBid) {
          await ctx.db.patch(winningBid._id, { status: "won" });
          await ctx.db.patch(session._id, {
            status: "payment_pending",
          });

          // Post chat message for auction win
          const winnerUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", winningBid.bidderId))
            .first();
          const winnerName = winnerUser?.alias ?? "Someone";
          const winnerAvatar = winnerUser?.selectedAvatar ?? winnerUser?.imageUrl;

          const winData = JSON.stringify({
            type: "auction_won",
            amount: winningBid.amount,
          });
          const messageBody = `:auction:${winData}`;

          await ctx.db.insert("messages", {
            user: winningBid.bidderId,
            userId: winningBid.bidderId,
            userName: winnerName,
            avatarUrl: winnerAvatar,
            body: messageBody,
          });
        }
        // If no bids, session stays open for next round
      }
    }

  },
});

// Auto-open bidding for active streams (called by cron)
export const autoOpenBidding = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get active livestreams
    const activeStreams = await ctx.db
      .query("livestreams")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const stream of activeStreams) {
      // Check if there's already an active bidding session
      const existingSession = await ctx.db
        .query("biddingSessions")
        .withIndex("by_livestream", (q) => q.eq("livestreamId", stream._id))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "open"),
            q.eq(q.field("status"), "payment_pending")
          )
        )
        .first();

      if (!existingSession) {
        // Calculate video timestamp (seconds since stream started)
        const videoTimestamp = Math.floor((Date.now() - stream.startedAt) / 1000);

        await ctx.db.insert("biddingSessions", {
          livestreamId: stream._id,
          videoTimestamp,
          openedAt: Date.now(),
          status: "open",
        });
      }
    }
  },
});

// Close all bidding sessions for a livestream when it ends
export const closeAllSessionsForStream = internalMutation({
  args: {
    livestreamId: v.id("livestreams"),
  },
  handler: async (ctx, args) => {
    const activeSessions = await ctx.db
      .query("biddingSessions")
      .withIndex("by_livestream", (q) => q.eq("livestreamId", args.livestreamId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "payment_pending")
        )
      )
      .collect();

    for (const session of activeSessions) {
      // Mark all active/won bids as expired
      const bids = await ctx.db
        .query("bids")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "won")
          )
        )
        .collect();

      for (const bid of bids) {
        await ctx.db.patch(bid._id, { status: "expired" });
      }

      await ctx.db.patch(session._id, { status: "expired" });
    }
  },
});
