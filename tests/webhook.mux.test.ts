/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { describe, expect, it } from "vitest";
import { ADMIN_LIBRARY_USER_ID } from "@/convex/adminSettings";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

describe("Webhook: Mux asset upsert scenarios", () => {
  it("saves asset with matching livestream - uses stream metadata", async () => {
    const t = convexTest(schema, modules);

    // Create a livestream record first
    const streamId = await t.mutation(api.livestream.startStream, {
      userId: "user_dj",
      userName: "DJ SNEAK",
      title: "Live House Set",
      description: "Chicago house vibes",
      provider: "mux",
      streamId: "ls_matched_123",
      streamKey: "sk_abc",
      playbackId: "pl_stream",
      playbackUrl: "https://stream.mux.com/pl_stream.m3u8",
      rtmpIngestUrl: "rtmp://global-live.mux.com:5222/app",
    } as any);

    expect(streamId).toBeDefined();

    // Simulate webhook upsert (what happens when Mux sends asset.ready)
    const videoId = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_from_stream_123",
      userId: ADMIN_LIBRARY_USER_ID, // Webhook always saves to admin library
      uploadedBy: "user_dj", // From stream.startedBy
      title: "Live House Set", // From stream.title
      description: "Chicago house vibes",
      playbackId: "pl_asset_ready",
      duration: 3600,
      status: "ready",
      visibility: "public",
      liveStreamId: "ls_matched_123",
    });

    // Verify video was created correctly
    const video = await t.query(api.videos.getVideo, { videoId });
    expect(video?.userId).toBe(ADMIN_LIBRARY_USER_ID);
    expect(video?.uploadedBy).toBe("user_dj");
    expect(video?.title).toBe("Live House Set");
    expect(video?.status).toBe("ready");
    expect(video?.assetId).toBe("asset_from_stream_123");
  });

  it("saves orphan asset to admin library when no matching livestream", async () => {
    const t = convexTest(schema, modules);

    // Simulate webhook upsert for an orphan recording
    // (no matching livestream record in Convex)
    const videoId = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_orphan_456",
      userId: ADMIN_LIBRARY_USER_ID, // Webhook fallback to admin library
      uploadedBy: undefined, // Unknown uploader
      title: "Livestream Recording 2025-01-09", // Default title
      description: "Recorded via Mux (stream: ls_unknown)",
      playbackId: "pl_orphan",
      duration: 7200,
      status: "ready",
      visibility: "public",
      liveStreamId: "ls_unknown", // Stream ID exists but no Convex record
    });

    // Verify video was saved to admin library
    const video = await t.query(api.videos.getVideo, { videoId });
    expect(video?.userId).toBe(ADMIN_LIBRARY_USER_ID);
    expect(video?.uploadedBy).toBeUndefined();
    expect(video?.status).toBe("ready");
    expect(video?.assetId).toBe("asset_orphan_456");
  });

  it("handles duplicate asset events idempotently", async () => {
    const t = convexTest(schema, modules);

    // First upsert (asset.created event)
    const videoId1 = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_dup_789",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "user_first",
      title: "First Title",
      status: "processing",
      visibility: "public",
    });

    // Second upsert (asset.ready event with same assetId)
    const videoId2 = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_dup_789",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "user_first",
      title: "Updated Title",
      playbackId: "pl_final",
      duration: 1800,
      status: "ready",
      visibility: "public",
    });

    // Should return the same video ID (upsert, not duplicate)
    expect(videoId1).toEqual(videoId2);

    // Verify the video was updated, not duplicated
    const video = await t.query(api.videos.getVideo, { videoId: videoId1 });
    expect(video?.status).toBe("ready");
    expect(video?.playbackId).toBe("pl_final");
    expect(video?.title).toBe("Updated Title");
  });

  it("updates existing video status from processing to ready", async () => {
    const t = convexTest(schema, modules);

    // Create initial video in processing state
    const videoId = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_status_update",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "user_status",
      title: "Status Test",
      status: "processing",
      visibility: "public",
    });

    let video = await t.query(api.videos.getVideo, { videoId });
    expect(video?.status).toBe("processing");

    // Update to ready (simulating asset.ready webhook)
    await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_status_update",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "user_status",
      title: "Status Test",
      playbackId: "pl_ready",
      duration: 600,
      status: "ready",
      visibility: "public",
    });

    video = await t.query(api.videos.getVideo, { videoId });
    expect(video?.status).toBe("ready");
    expect(video?.playbackId).toBe("pl_ready");
  });

  it("preserves uploadedBy when updating existing video", async () => {
    const t = convexTest(schema, modules);

    // Create video with uploadedBy
    const videoId = await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_preserve",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "original_uploader",
      title: "Preserve Test",
      status: "processing",
      visibility: "public",
    });

    // Update without uploadedBy (like an orphan follow-up event)
    await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_preserve",
      userId: ADMIN_LIBRARY_USER_ID,
      title: "Preserve Test",
      playbackId: "pl_preserve",
      status: "ready",
      visibility: "public",
    });

    const video = await t.query(api.videos.getVideo, { videoId });
    // uploadedBy should be preserved from the first insert
    expect(video?.uploadedBy).toBe("original_uploader");
  });

  it("getAdminLibraryVideos returns videos with uploader info", async () => {
    const t = convexTest(schema, modules);

    // Create a user
    await t.mutation(api.users.upsertUser, {
      clerkId: "user_with_alias",
      email: "dj@example.com",
      alias: "DJ SNEAK",
      imageUrl: "https://example.com/avatar.png",
    });

    // Create a video uploaded by that user
    await t.mutation(api.videos.upsertMuxAsset, {
      assetId: "asset_with_uploader",
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy: "user_with_alias",
      title: "Test Stream Recording",
      playbackId: "pl_test",
      status: "ready",
      visibility: "public",
    });

    // Query admin library
    const libraryVideos = await t.query(api.videos.getAdminLibraryVideos, {} as any);
    const video = libraryVideos.find((v: any) => v.assetId === "asset_with_uploader");

    expect(video).toBeDefined();
    expect(video?.uploaderAlias).toBe("DJ SNEAK");
  });
});

describe("Livestream end flow", () => {
  it("endStream creates video record with asset info", async () => {
    const t = convexTest(schema, modules);

    // Start a stream
    const streamId = await t.mutation(api.livestream.startStream, {
      userId: "user_end_test",
      userName: "Test DJ",
      title: "End Test Stream",
      provider: "mux",
      streamId: "ls_end_test",
      streamKey: "sk_end",
      playbackId: "pl_end",
      playbackUrl: "https://stream.mux.com/pl_end.m3u8",
      rtmpIngestUrl: "rtmp://global-live.mux.com:5222/app",
    } as any);

    // End stream with asset info (browser found it during polling)
    await t.mutation(api.livestream.endStream, {
      streamId,
      userId: "user_end_test",
      assetId: "asset_end_test",
      playbackId: "pl_asset_end",
      duration: 4500,
    });

    // Verify stream is ended
    const activeStream = await t.query(api.livestream.getActiveStream, {} as any);
    expect(activeStream).toBeNull();

    // Verify video was created in admin library
    const libraryVideos = await t.query(api.videos.getAdminLibraryVideos, {} as any);
    const video = libraryVideos.find((v: any) => v.assetId === "asset_end_test");

    expect(video).toBeDefined();
    expect(video?.title).toBe("End Test Stream");
    expect(video?.uploadedBy).toBe("user_end_test");
    expect(video?.duration).toBe(4500);
  });

  it("endStream without assetId still ends stream", async () => {
    const t = convexTest(schema, modules);

    // Start a stream
    const streamId = await t.mutation(api.livestream.startStream, {
      userId: "user_no_asset",
      userName: "Test DJ 2",
      title: "No Asset Stream",
      provider: "mux",
      streamId: "ls_no_asset",
    } as any);

    // End stream without asset (browser polling didn't find it)
    await t.mutation(api.livestream.endStream, {
      streamId,
      userId: "user_no_asset",
    });

    // Verify stream is ended
    const activeStream = await t.query(api.livestream.getActiveStream, {} as any);
    expect(activeStream).toBeNull();

    // No video should be created in this case
    // (webhook will handle it later when Mux sends asset.ready)
    const libraryVideos = await t.query(api.videos.getAdminLibraryVideos, {} as any);
    const video = libraryVideos.find((v: any) => v.title === "No Asset Stream");
    expect(video).toBeUndefined();
  });
});
