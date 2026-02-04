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

  messageLoves: defineTable({
    messageId: v.id("messages"),
    clerkId: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_user_message", ["clerkId", "messageId"]),

  users: defineTable({
    clerkId: v.string(),
    alias: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    selectedAvatar: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_alias", ["alias"])
    .index("by_isAdmin", ["isAdmin"]),

  follows: defineTable({
    followerId: v.string(), // Clerk user ID of the follower
    followingId: v.string(), // Clerk user ID being followed (e.g., "dj-sneak")
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_and_following", ["followerId", "followingId"]),

  videos: defineTable({
    userId: v.string(), // Clerk user ID of uploader
    uploadedBy: v.optional(v.string()), // Clerk user ID of admin uploader
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
    visibility: v.string(), // "public", "private", "followers", "ppv"
    viewCount: v.optional(v.number()),
    heartCount: v.optional(v.number()),
    isDefault: v.optional(v.boolean()), // Whether this is the default video to play
    startTime: v.optional(v.number()), // Timestamp (t0) when this video became default
    price: v.optional(v.number()), // Price in cents for PPV videos
    playbackPolicy: v.optional(v.string()), // "public" | "signed"
    linkedLivestreamId: v.optional(v.id("livestreams")), // Link to source livestream for recordings
    // Master download fields (Mux)
    masterStatus: v.optional(v.union(
      v.literal("preparing"),  // enableMasterAccess called, waiting for Mux
      v.literal("ready")       // master URL available
    )),
    masterUrl: v.optional(v.string()),
    masterExpiresAt: v.optional(v.number()), // timestamp when URL expires (24h from creation)
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"])
    .index("by_isDefault", ["isDefault"])
    .index("by_assetId", ["assetId"])
    .index("by_linkedLivestream", ["linkedLivestreamId"]),

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
    startedBy: v.optional(v.string()), // Clerk user ID who started the stream
    endedBy: v.optional(v.string()), // Clerk user ID who ended the stream
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // "active", "ended"
    startedAt: v.number(), // timestamp
    startedAtFromWebhook: v.optional(v.boolean()), // true if startedAt was updated by Mux webhook (actual streaming start)
    endedAt: v.optional(v.number()), // timestamp
    viewerCount: v.optional(v.number()),
    provider: v.optional(v.string()),
    streamId: v.optional(v.string()),
    streamKey: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    rtmpIngestUrl: v.optional(v.string()),
    // PPV fields
    visibility: v.optional(v.string()), // "public" | "ppv"
    price: v.optional(v.number()), // Price in cents for PPV livestreams
    recordingVideoId: v.optional(v.id("videos")), // Link to the recording after stream ends
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

  // Admin settings for controlling site features
  adminSettings: defineTable({
    key: v.string(), // unique setting key
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

  // Tips (all tips go to platform/DJ Sneak - single recipient)
  tips: defineTable({
    senderId: v.string(), // Clerk user ID of tipper
    amount: v.number(), // Amount in cents
    message: v.optional(v.string()),
    emoji: v.optional(v.string()), // "fire", "heart", "rocket"
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
    stripeSessionId: v.string(),
    status: v.string(), // "pending" | "completed" | "failed"
    createdAt: v.number(),
  })
    .index("by_livestream", ["livestreamId"])
    .index("by_video", ["videoId"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_session", ["stripeSessionId"]),

  // PPV Purchases
  purchases: defineTable({
    buyerId: v.string(), // Clerk user ID of buyer
    videoId: v.optional(v.id("videos")), // Optional - for video purchases
    livestreamId: v.optional(v.id("livestreams")), // Optional - for livestream purchases
    amount: v.number(), // Amount in cents
    stripeSessionId: v.string(),
    status: v.string(), // "pending" | "completed" | "failed"
    createdAt: v.number(),
  })
    .index("by_buyer_video", ["buyerId", "videoId"])
    .index("by_buyer_livestream", ["buyerId", "livestreamId"])
    .index("by_session", ["stripeSessionId"]),

  // Entitlements (derived from purchases or admin grants)
  entitlements: defineTable({
    userId: v.string(), // Clerk user ID
    // Content reference (one of these will be set)
    videoId: v.optional(v.id("videos")),
    livestreamId: v.optional(v.id("livestreams")),
    grantedAt: v.number(),
    grantedBy: v.string(), // "purchase" | admin clerkId
  })
    .index("by_user_video", ["userId", "videoId"])
    .index("by_user_livestream", ["userId", "livestreamId"])
    .index("by_user", ["userId"]),

  // Active bidding session (one per livestream at a time)
  biddingSessions: defineTable({
    livestreamId: v.id("livestreams"),
    videoTimestamp: v.number(), // Livestream timestamp when bidding opened
    openedAt: v.number(), // When bidding window opened
    status: v.string(), // "open" | "payment_pending" | "sold" | "expired"
    biddingEndsAt: v.optional(v.number()), // Countdown end - auto-set on first bid, reset on each outbid
    sealingEndsAt: v.optional(v.number()), // DEPRECATED - kept for legacy data
    paymentDeadline: v.optional(v.number()), // Payment window end after winning
  })
    .index("by_livestream", ["livestreamId"])
    .index("by_status", ["status"]),

  // Bid history
  bids: defineTable({
    sessionId: v.id("biddingSessions"),
    bidderId: v.string(), // Clerk user ID
    amount: v.number(), // Cents
    createdAt: v.number(),
    status: v.string(), // "active" | "outbid" | "won" | "expired"
  })
    .index("by_session", ["sessionId"])
    .index("by_session_status", ["sessionId", "status"]),

  // User's crate (purchased track moments)
  crate: defineTable({
    ownerId: v.string(), // Clerk user ID
    livestreamId: v.id("livestreams"),
    videoTimestamp: v.number(), // Where in the stream this track was
    purchaseAmount: v.number(), // Final price paid
    stripeSessionId: v.string(),
    purchasedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_session", ["stripeSessionId"]),
});
