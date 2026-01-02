import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    user: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    body: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
  }),

  users: defineTable({
    clerkId: v.string(),
    alias: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    selectedAvatar: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()), // Admin privileges flag
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
    .index("by_isDefault", ["isDefault"])
    .index("by_assetId", ["assetId"]),

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
    .index("by_status", ["status"])
    .index("by_streamId", ["streamId"]),

  // Synchronized playback state for default video
  playbackState: defineTable({
    videoId: v.id("videos"), // Which video is currently playing
    startTime: v.optional(v.number()), // Timestamp (t0) when video started playing
    currentTime: v.optional(v.number()), // Legacy field - current playback position
    isPlaying: v.optional(v.boolean()), // Legacy field - whether video is playing
    updatedAt: v.number(), // Timestamp of last update
  }),

  // Persistent stream credentials per user
  streamCredentials: defineTable({
    userId: v.string(), // Clerk user ID
    provider: v.string(), // "mux" or "livepeer"
    streamId: v.string(), // Provider's stream ID
    streamKey: v.string(), // RTMP stream key
    playbackId: v.string(), // Playback ID
    playbackUrl: v.string(), // HLS playback URL
    rtmpIngestUrl: v.string(), // RTMP ingest URL
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  nightclubAvatars: defineTable({
    clerkId: v.string(), // Owner Clerk ID (may differ from active viewer)
    aliasSnapshot: v.string(),
    imageUrl: v.optional(v.string()),
    prompt: v.optional(v.string()),
    seed: v.number(), // deterministic movement seed
    spawnedAt: v.number(),
    isActive: v.boolean(),
    lastConversationAt: v.optional(v.number()),
  })
    .index("by_active", ["isActive"])
    .index("by_clerk", ["clerkId"]),

  nightclubEncounters: defineTable({
    avatarA: v.id("nightclubAvatars"),
    avatarB: v.id("nightclubAvatars"),
    pairKey: v.string(),
    startedAt: v.number(),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    status: v.string(), // pending, completed, failed
  })
    .index("by_recent", ["startedAt"])
    .index("by_pair", ["pairKey"]),

  // Pre-generated avatar pool for instant loading (no reservations, immediate deletion)
  avatarPool: defineTable({
    imageUrl: v.string(),
    prompt: v.string(),
    seed: v.number(),
    createdAt: v.number(),
  }),

  // Admin settings for controlling site features
  adminSettings: defineTable({
    key: v.string(), // unique setting key (e.g., "showNightclubOnHome")
    value: v.boolean(), // boolean value for the setting
    updatedAt: v.number(),
    updatedBy: v.string(), // clerkId of admin who updated
  }).index("by_key", ["key"]),

  // Playlist queue for broadcast-style video playback
  playlist: defineTable({
    videoId: v.id("videos"), // Reference to video in queue
    addedBy: v.string(), // clerkId of user who queued it
    addedAt: v.number(), // Timestamp when added
    position: v.optional(v.number()), // Queue position (0 = next up)
    status: v.optional(v.string()), // "queued" | "playing" | "played"
    order: v.optional(v.number()), // Legacy field from old implementation
  })
    .index("by_status", ["status"])
    .index("by_position", ["position"])
    .index("by_status_and_position", ["status", "position"]),
});
