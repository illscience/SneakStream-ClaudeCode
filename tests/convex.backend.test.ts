/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { describe, expect, it } from "vitest";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

describe("Convex backend integration", () => {
  it("stores videos uploaded via Mux and exposes playback metadata", async () => {
    const t = convexTest(schema, modules);

    const videoId = await t.mutation(api.videos.createVideo, {
      userId: "user_123",
      title: "Test Video",
      description: "Sample",
      visibility: "public",
      provider: "mux",
      assetId: "asset_123",
      uploadId: "upload_123",
    } as any);

    await t.mutation(api.videos.updateVideoStatus, {
      videoId,
      status: "ready",
      playbackId: "pl_123",
      playbackUrl: "https://stream.mux.com/pl_123.m3u8",
      duration: 120,
    });

    const video = await t.query(api.videos.getVideo, { videoId });
    expect(video?.assetId).toBe("asset_123");
    expect(video?.playbackUrl).toBe("https://stream.mux.com/pl_123.m3u8");

    const userVideos = await t.query(api.videos.getUserVideos, { userId: "user_123" });
    expect(userVideos).toHaveLength(1);
    expect(userVideos[0]?.status).toBe("ready");

    const publicVideos = await t.query(api.videos.getPublicVideos, { limit: 10 });
    expect(publicVideos).toHaveLength(1);
  });

  it("tracks default video playback synchronization", async () => {
    const t = convexTest(schema, modules);

    const videoId = await t.mutation(api.videos.createVideo, {
      userId: "user_456",
      title: "Loop Video",
      visibility: "public",
      provider: "mux",
      assetId: "asset_loop",
      uploadId: "upload_loop",
    } as any);

    await t.mutation(api.videos.updateVideoStatus, {
      videoId,
      status: "ready",
      playbackId: "pl_loop",
      playbackUrl: "https://stream.mux.com/pl_loop.m3u8",
    });

    await t.mutation(api.videos.setDefaultVideo, { videoId });

    const defaultVideo = await t.query(api.videos.getDefaultVideo, {} as any);
    expect(defaultVideo?._id).toEqual(videoId);
    expect(defaultVideo?.isDefault).toBe(true);
    expect(defaultVideo?.startTime).toBeTypeOf("number");
  });

  it("manages live stream lifecycle with mux metadata", async () => {
    const t = convexTest(schema, modules);

    const streamId = await t.mutation(api.livestream.startStream, {
      userId: "user_streamer",
      userName: "DJ",
      title: "Live Set",
      provider: "mux",
      streamId: "ls_123",
      streamKey: "sk_456",
      playbackId: "pl_live",
      playbackUrl: "https://stream.mux.com/pl_live.m3u8",
      rtmpIngestUrl: "rtmp://global-live.mux.com:5222/app",
    } as any);

    const activeStream = await t.query(api.livestream.getActiveStream, {} as any);
    expect(activeStream?._id).toEqual(streamId);
    expect(activeStream?.provider).toBe("mux");

    await t.mutation(api.livestream.updateViewerCount, { streamId, viewerCount: 42 });
    const streams = await t.query(api.livestream.getUserStreams, { userId: "user_streamer" });
    expect(streams[0]?.viewerCount).toBe(42);

    await t.mutation(api.livestream.endStream, { streamId });
    const endedStream = await t.query(api.livestream.getActiveStream, {} as any);
    expect(endedStream).toBeNull();
  });
});
