import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ADMIN_LIBRARY_USER_ID, requireAdmin, getAuthenticatedUser, getOptionalAuthenticatedUser } from "./adminSettings";
import { logConvexTrace } from "./debugTrace";
import { upsertMuxRecording } from "./recordingIngest";

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
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only admins can create videos
    const uploadedBy = await requireAdmin(ctx);

    const resolvedProvider = args.provider || (args.livepeerAssetId ? "livepeer" : "mux");
    const resolvedAssetId = args.assetId || args.livepeerAssetId || undefined;
    logConvexTrace("videos.createVideo.called", {
      traceId: args.traceId,
      title: args.title,
      resolvedAssetId,
      resolvedProvider,
      uploadedBy,
    });

    if (resolvedAssetId) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_assetId", (q) => q.eq("assetId", resolvedAssetId))
        .order("desc")
        .first();

      logConvexTrace("videos.createVideo.existing_lookup", {
        traceId: args.traceId,
        resolvedAssetId,
        existingVideoId: existing?._id,
      });

      if (existing) {
        logConvexTrace("videos.createVideo.reused_existing", {
          traceId: args.traceId,
          resolvedAssetId,
          existingVideoId: existing._id,
        });
        return existing._id;
      }
    }

    const videoId = await ctx.db.insert("videos", {
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
    logConvexTrace("videos.createVideo.inserted", {
      traceId: args.traceId,
      videoId,
      resolvedAssetId,
      title: args.title,
      visibility: args.visibility,
    });
    return videoId;
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
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    logConvexTrace("videos.upsertMuxAsset.called", {
      traceId: args.traceId,
      assetId: args.assetId,
      userId: args.userId,
      title: args.title,
      status: args.status,
      playbackId: args.playbackId,
      liveStreamId: args.liveStreamId,
      linkedLivestreamId: args.linkedLivestreamId,
    });
    console.log("[videos.upsertMuxAsset] incoming", {
      assetId: args.assetId,
      userId: args.userId,
      title: args.title,
      status: args.status,
      playbackId: args.playbackId,
      liveStreamId: args.liveStreamId,
    });

    const result = await upsertMuxRecording(ctx, {
      source: "webhook",
      traceId: args.traceId,
      assetId: args.assetId,
      userId: args.userId,
      uploadedBy: args.uploadedBy,
      title: args.title,
      description: args.description,
      playbackId: args.playbackId,
      duration: args.duration,
      status: args.status,
      visibility: args.visibility,
      liveStreamId: args.liveStreamId,
      linkedLivestreamId: args.linkedLivestreamId,
    });

    logConvexTrace("videos.upsertMuxAsset.result", {
      traceId: args.traceId,
      assetId: args.assetId,
      videoId: result.videoId,
      playbackId: args.playbackId,
      status: args.status,
      action: result.action,
      linkStatus: result.linkStatus,
    });
    console.log("[videos.upsertMuxAsset] upsert result", {
      videoId: result.videoId,
      assetId: args.assetId,
      playbackId: args.playbackId,
      status: args.status,
      linkedLivestreamId: args.linkedLivestreamId,
      action: result.action,
      linkStatus: result.linkStatus,
    });

    const existingCandidate = await ctx.db
      .query("recordingCandidates")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .first();
    if (existingCandidate && !existingCandidate.resolvedVideoId) {
      await ctx.db.patch(existingCandidate._id, {
        resolvedVideoId: result.videoId,
        linkedLivestreamId: args.linkedLivestreamId,
        status: args.status || existingCandidate.status,
        duration: args.duration ?? existingCandidate.duration,
        playbackId: args.playbackId ?? existingCandidate.playbackId,
        lastSeenAt: Date.now(),
      });
    }

    return result.videoId;
  },
});

export const recordMuxAssetCandidate = mutation({
  args: {
    assetId: v.string(),
    liveStreamId: v.optional(v.string()),
    linkedLivestreamId: v.optional(v.id("livestreams")),
    playbackId: v.optional(v.string()),
    duration: v.optional(v.number()),
    status: v.optional(v.string()),
    reason: v.string(),
    eventType: v.string(),
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("recordingCandidates")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .first();

    if (existing) {
      const sourceEventTypes = existing.sourceEventTypes.includes(args.eventType)
        ? existing.sourceEventTypes
        : [...existing.sourceEventTypes, args.eventType];

      await ctx.db.patch(existing._id, {
        liveStreamId: args.liveStreamId ?? existing.liveStreamId,
        linkedLivestreamId: args.linkedLivestreamId ?? existing.linkedLivestreamId,
        playbackId: args.playbackId ?? existing.playbackId,
        duration: args.duration ?? existing.duration,
        status: args.status ?? existing.status,
        reason: args.reason,
        sourceEventTypes,
        traceId: args.traceId ?? existing.traceId,
        lastSeenAt: now,
      });
      logConvexTrace("videos.recordMuxAssetCandidate.updated", {
        traceId: args.traceId,
        assetId: args.assetId,
        liveStreamId: args.liveStreamId,
        reason: args.reason,
      });
      return existing._id;
    }

    const candidateId = await ctx.db.insert("recordingCandidates", {
      assetId: args.assetId,
      liveStreamId: args.liveStreamId,
      linkedLivestreamId: args.linkedLivestreamId,
      playbackId: args.playbackId,
      duration: args.duration,
      status: args.status,
      reason: args.reason,
      sourceEventTypes: [args.eventType],
      firstSeenAt: now,
      lastSeenAt: now,
      traceId: args.traceId,
    });

    logConvexTrace("videos.recordMuxAssetCandidate.inserted", {
      traceId: args.traceId,
      assetId: args.assetId,
      liveStreamId: args.liveStreamId,
      reason: args.reason,
      candidateId,
    });
    return candidateId;
  },
});

export const getRecordingCandidates = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    return await ctx.db
      .query("recordingCandidates")
      .withIndex("by_lastSeenAt")
      .order("desc")
      .take(limit);
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

// Inspect duplicate asset IDs for forensic debugging (admin only)
export const getDuplicateAssetGroups = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const videos = await ctx.db.query("videos").order("desc").collect();
    const byAssetId = new Map<
      string,
      Array<{
        id: string;
        creationTime: number;
        title: string;
        duration: number | undefined;
        status: string;
        linkedLivestreamId: string | undefined;
        uploadedBy: string | undefined;
        playbackId: string | undefined;
      }>
    >();

    for (const video of videos) {
      if (!video.assetId) {
        continue;
      }

      const current = byAssetId.get(video.assetId) ?? [];
      current.push({
        id: video._id,
        creationTime: video._creationTime,
        title: video.title,
        duration: video.duration,
        status: video.status,
        linkedLivestreamId: video.linkedLivestreamId,
        uploadedBy: video.uploadedBy,
        playbackId: video.playbackId,
      });
      byAssetId.set(video.assetId, current);
    }

    return Array.from(byAssetId.entries())
      .filter(([, rows]) => rows.length > 1)
      .map(([assetId, rows]) => ({
        assetId,
        count: rows.length,
        videos: rows.sort((a, b) => a.creationTime - b.creationTime),
      }))
      .sort((a, b) => b.count - a.count);
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
