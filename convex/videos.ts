import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ADMIN_LIBRARY_USER_ID, requireAdmin, getAuthenticatedUser, getOptionalAuthenticatedUser } from "./adminSettings";

const numberOrZero = (value?: number | null) =>
  typeof value === "number" ? value : 0;
const nonEmpty = (value?: string | null) =>
  typeof value === "string" && value.trim().length > 0;
const masterUrlMatchesAsset = (masterUrl: string | undefined, assetId: string) =>
  Boolean(masterUrl) && masterUrl.includes(`/${assetId}/`);

// Create a new video entry (admin only)
export const createVideo = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assetId: v.optional(v.string()),
    livepeerAssetId: v.optional(v.string()),
    uploadId: v.optional(v.string()),
    provider: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    visibility: v.string(),
    price: v.optional(v.number()),
    playbackPolicy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can create videos
    const uploadedBy = await requireAdmin(ctx);

    const resolvedProvider = args.provider || (args.livepeerAssetId ? "livepeer" : "mux");
    const resolvedAssetId = args.assetId || args.livepeerAssetId || undefined;

    if (resolvedAssetId) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", resolvedAssetId))
        .order("desc")
        .first();

      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("videos", {
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy,
      title: args.title,
      description: args.description,
      assetId: resolvedAssetId,
      ...(args.livepeerAssetId ? { livepeerAssetId: args.livepeerAssetId } : {}),
      uploadId: args.uploadId,
      provider: resolvedProvider,
      playbackId: args.playbackId,
      playbackUrl: args.playbackUrl,
      thumbnailUrl: args.thumbnailUrl,
      duration: args.duration,
      visibility: args.visibility,
      status: "processing",
      viewCount: 0,
      ...(args.price !== undefined ? { price: args.price } : {}),
      ...(args.playbackPolicy ? { playbackPolicy: args.playbackPolicy } : {}),
    });
  },
});

// INTERNAL: Upsert a Mux asset into the videos collection (called by webhook)
// Called from Mux webhook - security via webhook signature verification
export const upsertMuxAsset = mutation({
  args: {
    assetId: v.string(),
    userId: v.string(),
    uploadedBy: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    duration: v.optional(v.number()),
    status: v.optional(v.string()),
    visibility: v.optional(v.string()),
    liveStreamId: v.optional(v.string()),
    linkedLivestreamId: v.optional(v.id("livestreams")), // Convex livestream ID for PPV bundling
  },
  handler: async (ctx, args) => {
    console.log("[videos.upsertMuxAsset] incoming", {
      assetId: args.assetId,
      userId: args.userId,
      title: args.title,
      status: args.status,
      playbackId: args.playbackId,
      liveStreamId: args.liveStreamId,
    });

    let existing = await ctx.db
      .query("videos")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .first();

    if (!existing && args.liveStreamId) {
      const placeholderAssetId = `pending:${args.liveStreamId}`;
      existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", placeholderAssetId))
        .order("desc")
        .first();

      if (existing) {
        console.log("[videos.upsertMuxAsset] matched placeholder by liveStreamId", {
          placeholderAssetId,
          existingId: existing._id,
        });
      }
    }

    if (existing && args.assetId && existing.assetId !== args.assetId) {
      const conflict = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
        .order("desc")
        .first();

      if (conflict && conflict._id !== existing._id) {
        console.warn("[videos.upsertMuxAsset] assetId conflict, using existing asset record", {
          assetId: args.assetId,
          existingId: existing._id,
          conflictId: conflict._id,
        });
        existing = conflict;
      }
    }

    const playbackUrl = args.playbackId
      ? `https://stream.mux.com/${args.playbackId}.m3u8`
      : undefined;

    if (existing) {
      const updates: Record<string, unknown> = {};

      if (args.title) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.playbackId) {
        updates.playbackId = args.playbackId;
        updates.playbackUrl = playbackUrl;
      }
      if (args.duration !== undefined) updates.duration = args.duration;
      if (args.status) updates.status = args.status;
      if (args.visibility) updates.visibility = args.visibility;
      if (args.assetId && existing.assetId !== args.assetId) {
        updates.assetId = args.assetId;
      }
      if (args.userId && existing.userId !== args.userId) {
        updates.userId = args.userId;
      }
      if (args.uploadedBy && !existing.uploadedBy) {
        updates.uploadedBy = args.uploadedBy;
      }
      if (existing.provider !== "mux") updates.provider = "mux";

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        console.log("[videos.upsertMuxAsset] updated existing video", {
          videoId: existing._id,
          assetId: args.assetId,
          updates,
        });
      }

      return existing._id;
    }

    const newVideoId = await ctx.db.insert("videos", {
      userId: args.userId,
      uploadedBy: args.uploadedBy,
      title: args.title,
      description: args.description,
      provider: "mux",
      assetId: args.assetId,
      playbackId: args.playbackId,
      playbackUrl,
      duration: args.duration,
      status: args.status || "processing",
      visibility: args.visibility || "public",
      viewCount: 0,
      heartCount: 0,
      ...(args.linkedLivestreamId ? { linkedLivestreamId: args.linkedLivestreamId } : {}),
    });

    // If linked to a livestream, update the livestream with recordingVideoId
    if (args.linkedLivestreamId) {
      await ctx.db.patch(args.linkedLivestreamId, {
        recordingVideoId: newVideoId,
      });
    }

    console.log("[videos.upsertMuxAsset] inserted new video", {
      videoId: newVideoId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      status: args.status || "processing",
      linkedLivestreamId: args.linkedLivestreamId,
    });

    return newVideoId;
  },
});

// INTERNAL: Update video status (called by webhook)
export const updateVideoStatusInternal = internalMutation({
  args: {
    videoId: v.id("videos"),
    status: v.string(),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    progress: v.optional(v.number()),
    assetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { videoId, ...updates } = args;
    await ctx.db.patch(videoId, updates);
  },
});

// Update video status (admin only)
export const updateVideoStatus = mutation({
  args: {
    videoId: v.id("videos"),
    status: v.string(),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    progress: v.optional(v.number()),
    assetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can update video status
    await requireAdmin(ctx);
    const { videoId, ...updates } = args;
    await ctx.db.patch(videoId, updates);
  },
});

// Get user's videos
export const getUserVideos = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get shared admin library videos with uploader info (admin only)
export const getAdminLibraryVideos = query({
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_LIBRARY_USER_ID))
      .order("desc")
      .collect();

    const videosWithUploader = await Promise.all(
      videos.map(async (video) => {
        const uploadedBy = video.uploadedBy;
        if (!uploadedBy) {
          return { ...video, uploaderAlias: undefined, uploaderAvatar: undefined };
        }

        const uploader = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", uploadedBy))
          .first();

        return {
          ...video,
          uploaderAlias: uploader?.alias,
          uploaderAvatar: uploader?.selectedAvatar ?? uploader?.imageUrl,
        };
      })
    );

    return videosWithUploader;
  },
});

// List duplicate Mux asset IDs in the admin library (admin only)
export const listDuplicateMuxAssets = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_LIBRARY_USER_ID))
      .order("desc")
      .collect();

    const groups = new Map<string, typeof videos>();
    for (const video of videos) {
      if (video.provider !== "mux" || !video.assetId) continue;
      const list = groups.get(video.assetId) || [];
      list.push(video);
      groups.set(video.assetId, list);
    }

    const duplicates = [];
    for (const [assetId, list] of groups) {
      if (list.length > 1) {
        duplicates.push({
          assetId,
          count: list.length,
          videoIds: list.map((v) => v._id),
          durations: list.map((v) => v.duration ?? 0),
          titles: list.map((v) => v.title),
        });
      }
    }

    return duplicates;
  },
});

// Dedupe Mux assets in the admin library (admin only). Use dryRun to preview.
export const dedupeMuxAssets = mutation({
  args: {
    assetIds: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = Boolean(args.dryRun);
    const now = Date.now();

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", ADMIN_LIBRARY_USER_ID))
      .order("desc")
      .collect();

    const groups = new Map<string, typeof videos>();
    for (const video of videos) {
      if (video.provider !== "mux" || !video.assetId) continue;
      if (args.assetIds && !args.assetIds.includes(video.assetId)) continue;
      const list = groups.get(video.assetId) || [];
      list.push(video);
      groups.set(video.assetId, list);
    }

    const results = [];

    for (const [assetId, list] of groups) {
      if (list.length <= 1) continue;

      const sorted = [...list].sort((a, b) => {
        const durA = numberOrZero(a.duration);
        const durB = numberOrZero(b.duration);
        if (durA !== durB) return durB - durA; // longest wins
        const linkedA = a.linkedLivestreamId ? 1 : 0;
        const linkedB = b.linkedLivestreamId ? 1 : 0;
        if (linkedA !== linkedB) return linkedB - linkedA;
        const heartA = numberOrZero(a.heartCount);
        const heartB = numberOrZero(b.heartCount);
        if (heartA !== heartB) return heartB - heartA;
        const viewA = numberOrZero(a.viewCount);
        const viewB = numberOrZero(b.viewCount);
        if (viewA !== viewB) return viewB - viewA;
        return numberOrZero(b._creationTime) - numberOrZero(a._creationTime);
      });

      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      const duplicateIds = new Set(duplicates.map((v) => v._id));

      const patch: Record<string, unknown> = {};

      const maxDuration = Math.max(...list.map((v) => numberOrZero(v.duration)));
      if (numberOrZero(canonical.duration) < maxDuration) patch.duration = maxDuration;

      const maxHearts = Math.max(...list.map((v) => numberOrZero(v.heartCount)));
      if (numberOrZero(canonical.heartCount) < maxHearts) patch.heartCount = maxHearts;

      const maxViews = Math.max(...list.map((v) => numberOrZero(v.viewCount)));
      if (numberOrZero(canonical.viewCount) < maxViews) patch.viewCount = maxViews;

      if (!canonical.linkedLivestreamId) {
        const candidate = list.find((v) => v.linkedLivestreamId);
        if (candidate?.linkedLivestreamId) patch.linkedLivestreamId = candidate.linkedLivestreamId;
      }

      if (!canonical.isDefault && list.some((v) => v.isDefault)) {
        patch.isDefault = true;
        const defaultVideo = list.find((v) => v.isDefault && v.startTime);
        if (defaultVideo?.startTime) patch.startTime = defaultVideo.startTime;
      }

      if (!nonEmpty(canonical.title)) {
        const candidate = list.find((v) => nonEmpty(v.title));
        if (candidate?.title) patch.title = candidate.title;
      }

      if (!nonEmpty(canonical.description)) {
        const candidate = list.find((v) => nonEmpty(v.description));
        if (candidate?.description) patch.description = candidate.description;
      }

      if (!canonical.visibility) {
        const candidate = list.find((v) => v.visibility);
        if (candidate?.visibility) patch.visibility = candidate.visibility;
      }

      if (canonical.price === undefined) {
        const candidate = list.find((v) => v.price !== undefined);
        if (candidate?.price !== undefined) patch.price = candidate.price;
      }

      if (!canonical.playbackId) {
        const candidate = list.find((v) => v.playbackId);
        if (candidate?.playbackId) {
          patch.playbackId = candidate.playbackId;
          patch.playbackUrl = candidate.playbackUrl;
        }
      }

      if (!canonical.thumbnailUrl) {
        const candidate = list.find((v) => v.thumbnailUrl);
        if (candidate?.thumbnailUrl) patch.thumbnailUrl = candidate.thumbnailUrl;
      }

      const validMasters = list.filter(
        (v) =>
          v.masterUrl &&
          v.masterExpiresAt &&
          v.masterExpiresAt > now &&
          masterUrlMatchesAsset(v.masterUrl, assetId)
      );

      if (validMasters.length > 0) {
        const best = validMasters.sort(
          (a, b) => numberOrZero(b.masterExpiresAt) - numberOrZero(a.masterExpiresAt)
        )[0];
        patch.masterStatus = "ready";
        patch.masterUrl = best.masterUrl;
        patch.masterExpiresAt = best.masterExpiresAt;
      } else if (list.some((v) => v.masterStatus === "preparing")) {
        patch.masterStatus = "preparing";
        patch.masterUrl = undefined;
        patch.masterExpiresAt = undefined;
      } else if (canonical.masterStatus || canonical.masterUrl || canonical.masterExpiresAt) {
        patch.masterStatus = undefined;
        patch.masterUrl = undefined;
        patch.masterExpiresAt = undefined;
      }

      const referenceUpdates: Record<string, number> = {
        playlist: 0,
        playbackState: 0,
        purchases: 0,
        entitlements: 0,
        tips: 0,
        livestreams: 0,
      };

      const playlist = await ctx.db.query("playlist").collect();
      for (const item of playlist) {
        if (duplicateIds.has(item.videoId)) {
          referenceUpdates.playlist += 1;
          if (!dryRun) await ctx.db.patch(item._id, { videoId: canonical._id });
        }
      }

      const playbackState = await ctx.db.query("playbackState").collect();
      for (const state of playbackState) {
        if (duplicateIds.has(state.videoId)) {
          referenceUpdates.playbackState += 1;
          if (!dryRun) await ctx.db.patch(state._id, { videoId: canonical._id });
        }
      }

      const purchases = await ctx.db.query("purchases").collect();
      for (const purchase of purchases) {
        if (purchase.videoId && duplicateIds.has(purchase.videoId)) {
          referenceUpdates.purchases += 1;
          if (!dryRun) await ctx.db.patch(purchase._id, { videoId: canonical._id });
        }
      }

      const entitlements = await ctx.db.query("entitlements").collect();
      for (const entitlement of entitlements) {
        if (entitlement.videoId && duplicateIds.has(entitlement.videoId)) {
          referenceUpdates.entitlements += 1;
          if (!dryRun) await ctx.db.patch(entitlement._id, { videoId: canonical._id });
        }
      }

      const tips = await ctx.db.query("tips").collect();
      for (const tip of tips) {
        if (tip.videoId && duplicateIds.has(tip.videoId)) {
          referenceUpdates.tips += 1;
          if (!dryRun) await ctx.db.patch(tip._id, { videoId: canonical._id });
        }
      }

      const livestreams = await ctx.db.query("livestreams").collect();
      for (const stream of livestreams) {
        if (stream.recordingVideoId && duplicateIds.has(stream.recordingVideoId)) {
          referenceUpdates.livestreams += 1;
          if (!dryRun) await ctx.db.patch(stream._id, { recordingVideoId: canonical._id });
        }
      }

      if (!dryRun) {
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(canonical._id, patch);
        }
        for (const dup of duplicates) {
          await ctx.db.delete(dup._id);
        }
      }

      results.push({
        assetId,
        keepId: canonical._id,
        deleteIds: duplicates.map((v) => v._id),
        keptDuration: canonical.duration ?? 0,
        keptLinkedLivestream: Boolean(canonical.linkedLivestreamId),
        referenceUpdates,
        patch,
      });
    }

    return {
      dryRun,
      duplicatesFound: results.length,
      totalDeleted: dryRun ? 0 : results.reduce((sum, r) => sum + r.deleteIds.length, 0),
      results,
    };
  },
});

// One-time migration: Move admin's videos to shared library (admin only)
export const migrateVideosToSharedLibrary = mutation({
  args: {
    sourceUserId: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can run migrations
    await requireAdmin(ctx);

    const batchSize = args.batchSize ?? 50;
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", args.sourceUserId))
      .take(batchSize);

    let migrated = 0;
    let skipped = 0;

    for (const video of videos) {
      if (video.userId === ADMIN_LIBRARY_USER_ID) {
        skipped += 1;
        continue;
      }

      await ctx.db.patch(video._id, {
        uploadedBy: video.uploadedBy ?? video.userId,
        userId: ADMIN_LIBRARY_USER_ID,
      });
      migrated += 1;
    }

    const hasMore = videos.length === batchSize;
    return { migrated, skipped, hasMore, batchSize };
  },
});

// Get single video by ID
export const getVideo = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

// Get public videos (feed)
export const getPublicVideos = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("videos")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .take(limit);
  },
});

// Get videos from followed users
export const getFollowingVideos = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthenticatedUser(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit || 20;

    // Get list of users being followed
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();

    const followingIds = follows.map((f) => f.followingId);

    // Get videos from followed users
    const allVideos = await ctx.db
      .query("videos")
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .collect();

    return allVideos
      .filter((video) =>
        followingIds.includes(video.userId) &&
        (video.visibility === "public" || video.visibility === "followers")
      )
      .slice(0, limit);
  },
});

// Increment view count
export const incrementViewCount = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (video) {
      await ctx.db.patch(args.videoId, {
        viewCount: (video.viewCount || 0) + 1,
      });
    }
  },
});

// Increment heart count
export const incrementHeartCount = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (video) {
      await ctx.db.patch(args.videoId, {
        heartCount: (video.heartCount || 0) + 1,
      });
    }
  },
});

// Delete video (admin only)
// Safeguards against deleting recordings with crate purchases unless force=true
export const deleteVideo = mutation({
  args: {
    videoId: v.id("videos"),
    force: v.optional(v.boolean()), // Force delete - also removes crate entries
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can delete videos
    await requireAdmin(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    // Check if this video is a livestream recording
    if (video.linkedLivestreamId) {
      // Check for crate purchases linked to this livestream
      const crateEntries = await ctx.db
        .query("crate")
        .filter((q) => q.eq(q.field("livestreamId"), video.linkedLivestreamId))
        .collect();

      if (crateEntries.length > 0) {
        if (!args.force) {
          // Block deletion - there are crate purchases
          throw new Error(
            `Cannot delete video: ${crateEntries.length} crate purchase(s) reference this recording. ` +
            `Use force=true to delete the video and remove associated crate entries.`
          );
        }

        // Force delete - remove crate entries first
        for (const entry of crateEntries) {
          await ctx.db.delete(entry._id);
        }
        console.log("[videos.deleteVideo] Force deleted crate entries", {
          videoId: args.videoId,
          livestreamId: video.linkedLivestreamId,
          deletedCrateEntries: crateEntries.length,
        });
      }

      // Clear recordingVideoId from the linked livestream
      const livestream = await ctx.db.get(video.linkedLivestreamId);
      if (livestream && livestream.recordingVideoId === args.videoId) {
        await ctx.db.patch(video.linkedLivestreamId, {
          recordingVideoId: undefined,
        });
        console.log("[videos.deleteVideo] Cleared recordingVideoId from livestream", {
          videoId: args.videoId,
          livestreamId: video.linkedLivestreamId,
        });
      }
    }

    await ctx.db.delete(args.videoId);
    console.log("[videos.deleteVideo] Deleted video", {
      videoId: args.videoId,
      title: video.title,
      force: args.force ?? false,
    });
  },
});

// Update video details (admin only)
export const updateVideo = mutation({
  args: {
    videoId: v.id("videos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can update videos
    await requireAdmin(ctx);

    const { videoId, ...updates } = args;
    await ctx.db.patch(videoId, updates);
  },
});

// Set a video as the default video to play when no live stream is active (admin only)
export const setDefaultVideo = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can set default video
    await requireAdmin(ctx);

    // First, unset any existing default video
    const currentDefault = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .first();

    if (currentDefault) {
      await ctx.db.patch(currentDefault._id, { isDefault: false, startTime: undefined });
    }

    // Set the new default video with t0 (start timestamp)
    const startTime = Date.now();
    await ctx.db.patch(args.videoId, {
      isDefault: true,
      startTime: startTime
    });

    // Initialize synchronized playback state
    const existingState = await ctx.db
      .query("playbackState")
      .first();

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        videoId: args.videoId,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playbackState", {
        videoId: args.videoId,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    }
  },
});

// Unset the default video (admin only)
export const unsetDefaultVideo = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can unset default video
    await requireAdmin(ctx);

    await ctx.db.patch(args.videoId, { isDefault: false });
  },
});

// Get the current default video
export const getDefaultVideo = query({
  handler: async (ctx) => {
    const defaultVideo = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .first();

    return defaultVideo;
  },
});

// Request master download - sets status to "preparing" (admin only)
export const requestMasterDownload = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    // Check if already preparing or ready (not expired)
    if (video.masterStatus === "preparing") {
      return { status: "already_preparing" };
    }

    if (video.masterStatus === "ready" && video.masterExpiresAt && video.masterExpiresAt > Date.now()) {
      return { status: "already_ready", masterUrl: video.masterUrl };
    }

    // Set status to preparing
    await ctx.db.patch(args.videoId, {
      masterStatus: "preparing",
      masterUrl: undefined,
      masterExpiresAt: undefined,
    });

    return { status: "preparing" };
  },
});

// Update master status when Mux reports ready (admin only)
export const updateMasterStatus = mutation({
  args: {
    videoId: v.id("videos"),
    status: v.union(v.literal("preparing"), v.literal("ready")),
    masterUrl: v.optional(v.string()),
    masterExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    await ctx.db.patch(args.videoId, {
      masterStatus: args.status,
      masterUrl: args.masterUrl,
      masterExpiresAt: args.masterExpiresAt,
    });
  },
});

// Clear expired master URLs (can be called periodically or on page load)
export const clearExpiredMasters = mutation({
  args: { videoIds: v.optional(v.array(v.id("videos"))) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    let cleared = 0;

    if (args.videoIds && args.videoIds.length > 0) {
      // Clear specific videos
      for (const videoId of args.videoIds) {
        const video = await ctx.db.get(videoId);
        if (video && video.masterExpiresAt && video.masterExpiresAt < now) {
          await ctx.db.patch(videoId, {
            masterStatus: undefined,
            masterUrl: undefined,
            masterExpiresAt: undefined,
          });
          cleared++;
        }
      }
    } else {
      // Clear all expired - query all videos with masterStatus
      const videos = await ctx.db
        .query("videos")
        .filter((q) => q.neq(q.field("masterStatus"), undefined))
        .collect();

      for (const video of videos) {
        if (video.masterExpiresAt && video.masterExpiresAt < now) {
          await ctx.db.patch(video._id, {
            masterStatus: undefined,
            masterUrl: undefined,
            masterExpiresAt: undefined,
          });
          cleared++;
        }
      }
    }

    return { cleared };
  },
});

// Get videos with preparing master status (for polling - kept as fallback)
export const getPreparingDownloads = query({
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("videos")
      .filter((q) => q.eq(q.field("masterStatus"), "preparing"))
      .collect();

    return videos.map((v) => ({
      _id: v._id,
      assetId: v.assetId,
      title: v.title,
    }));
  },
});

// Update master status by Mux assetId (called by webhook - no admin check, webhook signature is verified)
export const updateMasterStatusByAssetId = mutation({
  args: {
    assetId: v.string(),
    status: v.union(v.literal("preparing"), v.literal("ready")),
    masterUrl: v.optional(v.string()),
    masterExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("videos")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .first();

    if (!video) {
      console.log("[videos.updateMasterStatusByAssetId] Video not found for assetId:", args.assetId);
      return { ok: false, reason: "Video not found" };
    }

    await ctx.db.patch(video._id, {
      masterStatus: args.status,
      masterUrl: args.masterUrl,
      masterExpiresAt: args.masterExpiresAt,
    });

    console.log("[videos.updateMasterStatusByAssetId] Updated", {
      videoId: video._id,
      assetId: args.assetId,
      status: args.status,
      hasUrl: !!args.masterUrl,
    });

    return { ok: true, videoId: video._id };
  },
});

// Clear master status by Mux assetId (called by webhook on delete/error)
export const clearMasterByAssetId = mutation({
  args: {
    assetId: v.string(),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("videos")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .first();

    if (!video) {
      console.log("[videos.clearMasterByAssetId] Video not found for assetId:", args.assetId);
      return { ok: false, reason: "Video not found" };
    }

    await ctx.db.patch(video._id, {
      masterStatus: undefined,
      masterUrl: undefined,
      masterExpiresAt: undefined,
    });

    console.log("[videos.clearMasterByAssetId] Cleared", {
      videoId: video._id,
      assetId: args.assetId,
    });

    return { ok: true, videoId: video._id };
  },
});
