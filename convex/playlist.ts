import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get the current playlist ordered by position
export const getPlaylist = query({
  handler: async (ctx) => {
    const playlistEntries = await ctx.db
      .query("playlist")
      .withIndex("by_status_and_position", (q) => q.eq("status", "queued"))
      .order("asc")
      .collect();

    // Filter out entries without position and status
    const validEntries = playlistEntries.filter(e => 
      e.position !== undefined && e.status === "queued"
    );
    
    // Enrich with video details
    const enrichedPlaylist = await Promise.all(
      validEntries.map(async (entry) => {
        const video = await ctx.db.get(entry.videoId);
        return {
          ...entry,
          video,
        };
      })
    );

    return enrichedPlaylist;
  },
});

// Get the next video in the playlist (first queued video)
export const getNextInPlaylist = query({
  handler: async (ctx) => {
    const nextEntry = await ctx.db
      .query("playlist")
      .withIndex("by_status_and_position", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!nextEntry) return null;

    const video = await ctx.db.get(nextEntry.videoId);
    return {
      ...nextEntry,
      video,
    };
  },
});

// Add a video to the playlist
export const addToPlaylist = mutation({
  args: {
    videoId: v.id("videos"),
    clerkId: v.string(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // If no position specified, add to end
    let targetPosition = args.position;
    
    if (targetPosition === undefined) {
      const lastEntry = await ctx.db
        .query("playlist")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .order("desc")
        .first();
      
      targetPosition = lastEntry ? lastEntry.position + 1 : 0;
    } else {
      // Shift existing entries down
      const entriesToShift = await ctx.db
        .query("playlist")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      
      for (const entry of entriesToShift) {
        if (entry.position >= targetPosition) {
          await ctx.db.patch(entry._id, {
            position: entry.position + 1,
          });
        }
      }
    }

    return await ctx.db.insert("playlist", {
      videoId: args.videoId,
      addedBy: args.clerkId,
      addedAt: Date.now(),
      position: targetPosition,
      status: "queued",
    });
  },
});

// Play a video immediately (switches all viewers now)
export const playNow = mutation({
  args: {
    videoId: v.id("videos"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the video
    const video = await ctx.db.get(args.videoId);
    if (!video || video.status !== "ready") {
      throw new Error("Video not ready for playback");
    }

    // Unset any existing default video
    const currentDefault = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .first();

    if (currentDefault) {
      await ctx.db.patch(currentDefault._id, {
        isDefault: false,
        startTime: undefined,
      });
    }

    // Set the new video as default with start time
    const startTime = Date.now();
    await ctx.db.patch(args.videoId, {
      isDefault: true,
      startTime: startTime,
    });

    // Update synchronized playback state
    const existingState = await ctx.db.query("playbackState").first();

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

    // Mark any existing playlist entry for this video as playing
    const existingPlaylistEntry = await ctx.db
      .query("playlist")
      .filter((q) => q.eq(q.field("videoId"), args.videoId))
      .first();

    if (existingPlaylistEntry) {
      await ctx.db.patch(existingPlaylistEntry._id, {
        status: "playing",
      });
    }
  },
});

// Queue video to play next (position 0)
export const playNext = mutation({
  args: {
    videoId: v.id("videos"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if video already exists in playlist
    const existingEntry = await ctx.db
      .query("playlist")
      .filter((q) => 
        q.and(
          q.eq(q.field("videoId"), args.videoId),
          q.eq(q.field("status"), "queued")
        )
      )
      .first();

    if (existingEntry) {
      // Move to position 0
      const entriesToShift = await ctx.db
        .query("playlist")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      
      for (const entry of entriesToShift) {
        if (entry._id !== existingEntry._id && entry.position < existingEntry.position) {
          await ctx.db.patch(entry._id, {
            position: entry.position + 1,
          });
        }
      }

      await ctx.db.patch(existingEntry._id, {
        position: 0,
      });
    } else {
      // Add as new entry at position 0
      await addToPlaylist(ctx, {
        videoId: args.videoId,
        clerkId: args.clerkId,
        position: 0,
      });
    }
  },
});

// Remove a video from the playlist
export const removeFromPlaylist = mutation({
  args: {
    playlistId: v.id("playlist"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.playlistId);
    if (!entry) return;

    // Shift positions of entries after this one
    const entriesToShift = await ctx.db
      .query("playlist")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    
    for (const e of entriesToShift) {
      if (e.position > entry.position) {
        await ctx.db.patch(e._id, {
          position: e.position - 1,
        });
      }
    }

    await ctx.db.delete(args.playlistId);
  },
});

// Reorder a playlist entry
export const reorderPlaylist = mutation({
  args: {
    playlistId: v.id("playlist"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.playlistId);
    if (!entry) return;

    const oldPosition = entry.position;
    const newPosition = args.newPosition;

    if (oldPosition === newPosition) return;

    const allEntries = await ctx.db
      .query("playlist")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    // Moving down (increasing position)
    if (newPosition > oldPosition) {
      for (const e of allEntries) {
        if (e._id === args.playlistId) continue;
        if (e.position > oldPosition && e.position <= newPosition) {
          await ctx.db.patch(e._id, {
            position: e.position - 1,
          });
        }
      }
    }
    // Moving up (decreasing position)
    else {
      for (const e of allEntries) {
        if (e._id === args.playlistId) continue;
        if (e.position >= newPosition && e.position < oldPosition) {
          await ctx.db.patch(e._id, {
            position: e.position + 1,
          });
        }
      }
    }

    await ctx.db.patch(args.playlistId, {
      position: newPosition,
    });
  },
});

// Advance to the next video in playlist (called when current video ends)
export const advancePlaylist = mutation({
  args: {},
  handler: async (ctx) => {
    // Get the next queued video
    const nextEntry = await ctx.db
      .query("playlist")
      .withIndex("by_status_and_position", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!nextEntry) {
      // No next video, let current video loop
      return null;
    }

    const nextVideo = await ctx.db.get(nextEntry.videoId);
    if (!nextVideo || nextVideo.status !== "ready") {
      // Skip this video, remove it and try next
      await ctx.db.delete(nextEntry._id);
      return await advancePlaylist(ctx, {});
    }

    // Mark current playing entry as played
    const currentPlaying = await ctx.db
      .query("playlist")
      .withIndex("by_status", (q) => q.eq("status", "playing"))
      .first();

    if (currentPlaying) {
      await ctx.db.patch(currentPlaying._id, {
        status: "played",
      });
    }

    // Unset current default video
    const currentDefault = await ctx.db
      .query("videos")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .first();

    if (currentDefault) {
      await ctx.db.patch(currentDefault._id, {
        isDefault: false,
        startTime: undefined,
      });
    }

    // Set next video as default
    const startTime = Date.now();
    await ctx.db.patch(nextVideo._id, {
      isDefault: true,
      startTime: startTime,
    });

    // Update playback state
    const existingState = await ctx.db.query("playbackState").first();

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        videoId: nextVideo._id,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playbackState", {
        videoId: nextVideo._id,
        startTime: startTime,
        updatedAt: Date.now(),
      });
    }

    // Mark playlist entry as playing and shift positions
    await ctx.db.patch(nextEntry._id, {
      status: "playing",
    });

    // Shift all remaining queued entries up by 1
    const remainingEntries = await ctx.db
      .query("playlist")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    for (const entry of remainingEntries) {
      await ctx.db.patch(entry._id, {
        position: entry.position - 1,
      });
    }

    return nextVideo;
  },
});

// Check if a video is currently in the playlist
export const isInPlaylist = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("playlist")
      .filter((q) => 
        q.and(
          q.eq(q.field("videoId"), args.videoId),
          q.eq(q.field("status"), "queued")
        )
      )
      .first();

    return !!entry;
  },
});

// Get playlist position for a video
export const getPlaylistPosition = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("playlist")
      .filter((q) => 
        q.and(
          q.eq(q.field("videoId"), args.videoId),
          q.eq(q.field("status"), "queued")
        )
      )
      .first();

    return entry?.position;
  },
});

