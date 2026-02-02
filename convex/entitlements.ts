import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./adminSettings";

// Grant entitlement for a video
export const grantEntitlement = mutation({
  args: {
    userId: v.string(),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
    grantedBy: v.string(), // "purchase" or admin clerkId
  },
  handler: async (ctx, args) => {
    // Must specify at least one content type
    if (!args.videoId && !args.livestreamId) {
      throw new Error("Must specify either videoId or livestreamId");
    }

    // Check if entitlement already exists
    if (args.videoId) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_user_video", (q) =>
          q.eq("userId", args.userId).eq("videoId", args.videoId)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    if (args.livestreamId) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_user_livestream", (q) =>
          q.eq("userId", args.userId).eq("livestreamId", args.livestreamId)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    const entitlementId = await ctx.db.insert("entitlements", {
      userId: args.userId,
      videoId: args.videoId,
      livestreamId: args.livestreamId,
      grantedAt: Date.now(),
      grantedBy: args.grantedBy,
    });

    return entitlementId;
  },
});

// Revoke video entitlement
export const revokeEntitlement = mutation({
  args: {
    userId: v.string(),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
  },
  handler: async (ctx, args) => {
    if (args.videoId) {
      const entitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_video", (q) =>
          q.eq("userId", args.userId).eq("videoId", args.videoId)
        )
        .first();

      if (entitlement) {
        await ctx.db.delete(entitlement._id);
        return true;
      }
    }

    if (args.livestreamId) {
      const entitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_livestream", (q) =>
          q.eq("userId", args.userId).eq("livestreamId", args.livestreamId)
        )
        .first();

      if (entitlement) {
        await ctx.db.delete(entitlement._id);
        return true;
      }
    }

    return false;
  },
});

// Simple entitlement check (direct only, no bundling)
export const hasEntitlement = query({
  args: {
    userId: v.string(),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
  },
  handler: async (ctx, args) => {
    if (args.videoId) {
      const entitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_video", (q) =>
          q.eq("userId", args.userId).eq("videoId", args.videoId)
        )
        .first();

      if (entitlement) return true;
    }

    if (args.livestreamId) {
      const entitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_livestream", (q) =>
          q.eq("userId", args.userId).eq("livestreamId", args.livestreamId)
        )
        .first();

      if (entitlement) return true;
    }

    return false;
  },
});

// Bundled entitlement check - checks both direct and linked content
// If user has access to livestream, they also have access to its recording (and vice versa)
export const hasBundledEntitlement = query({
  args: {
    userId: v.string(),
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
  },
  handler: async (ctx, { userId, videoId, livestreamId }) => {
    // 1. Check direct video entitlement
    if (videoId) {
      const videoEntitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_video", (q) =>
          q.eq("userId", userId).eq("videoId", videoId)
        )
        .first();
      if (videoEntitlement) return true;

      // 2. Check if video has linked livestream, and user has that entitlement
      const video = await ctx.db.get(videoId);
      if (video?.linkedLivestreamId) {
        const livestreamEntitlement = await ctx.db
          .query("entitlements")
          .withIndex("by_user_livestream", (q) =>
            q.eq("userId", userId).eq("livestreamId", video.linkedLivestreamId)
          )
          .first();
        if (livestreamEntitlement) return true;
      }
    }

    // 3. Check direct livestream entitlement
    if (livestreamId) {
      const livestreamEntitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_livestream", (q) =>
          q.eq("userId", userId).eq("livestreamId", livestreamId)
        )
        .first();
      if (livestreamEntitlement) return true;

      // 4. Check if livestream has recording, and user has that entitlement
      const livestream = await ctx.db.get(livestreamId);
      if (livestream?.recordingVideoId) {
        const videoEntitlement = await ctx.db
          .query("entitlements")
          .withIndex("by_user_video", (q) =>
            q.eq("userId", userId).eq("videoId", livestream.recordingVideoId)
          )
          .first();
        if (videoEntitlement) return true;
      }
    }

    return false;
  },
});

// Get all entitlements for a user
export const getUserEntitlements = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch content info for each entitlement
    const entitlementsWithContent = await Promise.all(
      entitlements.map(async (entitlement) => {
        let title = "Unknown Content";
        let thumbnail: string | undefined;
        let contentType: "video" | "livestream" = "video";

        if (entitlement.videoId) {
          const video = await ctx.db.get(entitlement.videoId);
          title = video?.title ?? "Unknown Video";
          thumbnail = video?.thumbnailUrl;
          contentType = "video";
        } else if (entitlement.livestreamId) {
          const livestream = await ctx.db.get(entitlement.livestreamId);
          title = livestream?.title ?? "Unknown Livestream";
          contentType = "livestream";
        }

        return {
          ...entitlement,
          title,
          thumbnail,
          contentType,
        };
      })
    );

    return entitlementsWithContent;
  },
});

// Get all users with entitlement to a video
export const getVideoEntitlements = query({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .filter((q) => q.eq(q.field("videoId"), args.videoId))
      .collect();

    // Fetch user info for each entitlement
    const entitlementsWithUsers = await Promise.all(
      entitlements.map(async (entitlement) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", entitlement.userId))
          .first();

        return {
          ...entitlement,
          userName: user?.alias ?? "Unknown User",
          userAvatar: user?.selectedAvatar ?? user?.imageUrl,
        };
      })
    );

    return entitlementsWithUsers;
  },
});

// Get all users with entitlement to a livestream
export const getLivestreamEntitlements = query({
  args: {
    livestreamId: v.id("livestreams"),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .filter((q) => q.eq(q.field("livestreamId"), args.livestreamId))
      .collect();

    // Fetch user info for each entitlement
    const entitlementsWithUsers = await Promise.all(
      entitlements.map(async (entitlement) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", entitlement.userId))
          .first();

        return {
          ...entitlement,
          userName: user?.alias ?? "Unknown User",
          userAvatar: user?.selectedAvatar ?? user?.imageUrl,
        };
      })
    );

    return entitlementsWithUsers;
  },
});

// Get count of entitlements for a livestream (used as approximate viewer count)
export const getLivestreamEntitlementCount = query({
  args: {
    livestreamId: v.id("livestreams"),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .filter((q) => q.eq(q.field("livestreamId"), args.livestreamId))
      .collect();

    return entitlements.length;
  },
});

// ============================================
// Admin Dashboard Queries
// ============================================

// Get all entitlements with user and content info (admin only)
export const getAllEntitlements = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const entitlements = await ctx.db.query("entitlements").order("desc").collect();

    const enriched = await Promise.all(
      entitlements.map(async (ent) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", ent.userId))
          .first();

        let contentTitle = "Unknown";
        let contentType: "video" | "livestream" = "video";

        if (ent.videoId) {
          const video = await ctx.db.get(ent.videoId);
          contentTitle = video?.title ?? "Deleted Video";
          contentType = "video";
        } else if (ent.livestreamId) {
          const livestream = await ctx.db.get(ent.livestreamId);
          contentTitle = livestream?.title ?? "Deleted Livestream";
          contentType = "livestream";
        }

        return {
          _id: ent._id,
          userId: ent.userId,
          videoId: ent.videoId,
          livestreamId: ent.livestreamId,
          grantedAt: ent.grantedAt,
          grantedBy: ent.grantedBy,
          userName: user?.alias ?? "Unknown User",
          userEmail: user?.email,
          contentTitle,
          contentType,
        };
      })
    );

    return enriched;
  },
});

// Get all PPV videos for admin dropdown (admin only)
export const getPPVVideos = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get all videos that are PPV or have signed playback
    const allVideos = await ctx.db.query("videos").order("desc").collect();

    return allVideos
      .filter((v) => v.visibility === "ppv" || v.playbackPolicy === "signed")
      .map((v) => ({
        _id: v._id,
        title: v.title,
        visibility: v.visibility,
        price: v.price,
        linkedLivestreamId: v.linkedLivestreamId,
      }));
  },
});

// Get all PPV livestreams for admin dropdown (admin only)
export const getPPVLivestreams = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allLivestreams = await ctx.db.query("livestreams").order("desc").collect();

    return allLivestreams
      .filter((ls) => ls.visibility === "ppv")
      .map((ls) => ({
        _id: ls._id,
        title: ls.title,
        visibility: ls.visibility,
        price: ls.price,
        recordingVideoId: ls.recordingVideoId,
        status: ls.status,
      }));
  },
});

// Get all videos for admin (for testing bundled entitlements)
export const getAllVideosForAdmin = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    const videos = await ctx.db.query("videos").order("desc").take(limit);

    return videos.map((v) => ({
      _id: v._id,
      title: v.title,
      visibility: v.visibility,
      price: v.price,
      linkedLivestreamId: v.linkedLivestreamId,
      status: v.status,
    }));
  },
});

// Get all livestreams for admin
export const getAllLivestreamsForAdmin = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    const livestreams = await ctx.db.query("livestreams").order("desc").take(limit);

    return livestreams.map((ls) => ({
      _id: ls._id,
      title: ls.title,
      visibility: ls.visibility,
      price: ls.price,
      recordingVideoId: ls.recordingVideoId,
      status: ls.status,
    }));
  },
});

// Admin grant entitlement (with admin check)
export const adminGrantEntitlement = mutation({
  args: {
    targetUserId: v.string(), // User to grant entitlement to
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
  },
  handler: async (ctx, args) => {
    const adminClerkId = await requireAdmin(ctx);

    if (!args.videoId && !args.livestreamId) {
      throw new Error("Must specify either videoId or livestreamId");
    }

    // Check if entitlement already exists
    if (args.videoId) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_user_video", (q) =>
          q.eq("userId", args.targetUserId).eq("videoId", args.videoId)
        )
        .first();
      if (existing) {
        throw new Error("Entitlement already exists for this video");
      }
    }

    if (args.livestreamId) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_user_livestream", (q) =>
          q.eq("userId", args.targetUserId).eq("livestreamId", args.livestreamId)
        )
        .first();
      if (existing) {
        throw new Error("Entitlement already exists for this livestream");
      }
    }

    return await ctx.db.insert("entitlements", {
      userId: args.targetUserId,
      videoId: args.videoId,
      livestreamId: args.livestreamId,
      grantedAt: Date.now(),
      grantedBy: adminClerkId,
    });
  },
});

// Admin revoke entitlement
export const adminRevokeEntitlement = mutation({
  args: {
    entitlementId: v.id("entitlements"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) {
      throw new Error("Entitlement not found");
    }

    await ctx.db.delete(args.entitlementId);
    return true;
  },
});

// Admin update video PPV settings
export const adminUpdateVideoPPV = mutation({
  args: {
    videoId: v.id("videos"),
    visibility: v.string(), // "public" | "ppv" | "private" | "followers"
    price: v.optional(v.number()), // Price in cents (required if visibility is "ppv")
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    const updates: Record<string, unknown> = {
      visibility: args.visibility,
    };

    if (args.visibility === "ppv") {
      if (!args.price || args.price <= 0) {
        throw new Error("Price is required for PPV videos");
      }
      updates.price = args.price;
      updates.playbackPolicy = "signed";
    } else {
      // Clear PPV-specific fields when switching to non-PPV
      updates.price = undefined;
      updates.playbackPolicy = "public";
    }

    await ctx.db.patch(args.videoId, updates);
    return true;
  },
});

// Admin update livestream PPV settings
export const adminUpdateLivestreamPPV = mutation({
  args: {
    livestreamId: v.id("livestreams"),
    visibility: v.string(), // "public" | "ppv"
    price: v.optional(v.number()), // Price in cents (required if visibility is "ppv")
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const livestream = await ctx.db.get(args.livestreamId);
    if (!livestream) {
      throw new Error("Livestream not found");
    }

    const updates: Record<string, unknown> = {
      visibility: args.visibility,
    };

    if (args.visibility === "ppv") {
      if (!args.price || args.price <= 0) {
        throw new Error("Price is required for PPV livestreams");
      }
      updates.price = args.price;
    } else {
      updates.price = undefined;
    }

    await ctx.db.patch(args.livestreamId, updates);
    return true;
  },
});
