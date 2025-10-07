import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    user: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    body: v.string(),
  }),

  users: defineTable({
    clerkId: v.string(),
    alias: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  follows: defineTable({
    followerId: v.string(), // Clerk user ID of the follower
    followingId: v.string(), // Clerk user ID being followed (e.g., "dj-sneak")
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_and_following", ["followerId", "followingId"]),

  videos: defineTable({
    userId: v.string(), // Clerk user ID of uploader
    title: v.string(),
    description: v.optional(v.string()),
    provider: v.optional(v.string()), // e.g., "mux"
    assetId: v.optional(v.string()), // Mux asset ID
    livepeerAssetId: v.optional(v.string()), // Legacy Livepeer asset identifier
    uploadId: v.optional(v.string()), // Mux upload ID for direct uploads
    playbackId: v.optional(v.string()), // Mux playback ID
    playbackUrl: v.optional(v.string()), // HLS playback URL
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()), // Duration in seconds
    status: v.string(), // "uploading", "processing", "ready", "failed"
    progress: v.optional(v.number()), // Processing progress (0-1)
    visibility: v.string(), // "public", "private", "followers"
    viewCount: v.optional(v.number()),
    heartCount: v.optional(v.number()),
    isDefault: v.optional(v.boolean()), // Whether this is the default video to play
    startTime: v.optional(v.number()), // Timestamp (t0) when this video became default
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"])
    .index("by_isDefault", ["isDefault"]),

  events: defineTable({
    artist: v.string(),
    eventName: v.string(),
    venue: v.string(),
    location: v.string(),
    date: v.string(),
    time: v.string(),
    url: v.string(),
    description: v.string(),
    searchedAt: v.number(), // timestamp when this was found
    model: v.string(), // which AI model found this
  })
    .index("by_artist", ["artist"])
    .index("by_searchedAt", ["searchedAt"]),

  livestreams: defineTable({
    userId: v.string(), // Clerk user ID of broadcaster
    userName: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // "active", "ended"
    startedAt: v.number(), // timestamp
    endedAt: v.optional(v.number()), // timestamp
    viewerCount: v.optional(v.number()),
    provider: v.optional(v.string()),
    streamId: v.optional(v.string()),
    streamKey: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    rtmpIngestUrl: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Synchronized playback state for default video
  playbackState: defineTable({
    videoId: v.id("videos"), // Which video is currently playing
    startTime: v.optional(v.number()), // Timestamp (t0) when video started playing
    currentTime: v.optional(v.number()), // Legacy field - current playback position
    isPlaying: v.optional(v.boolean()), // Legacy field - whether video is playing
    updatedAt: v.number(), // Timestamp of last update
  }),
});
