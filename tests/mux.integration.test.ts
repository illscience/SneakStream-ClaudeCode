import { describe, expect, it, vi } from "vitest";
import {
  createDirectUpload,
  createLiveStream,
  getAsset,
  getMuxPlaybackUrl,
  getUploadStatus,
} from "@/lib/mux";

const mockFetch = (responses: Array<{ status?: number; body: unknown }>) => {
  let call = 0;
  vi.spyOn(global, "fetch").mockImplementation(async () => {
    const responseConfig = responses[call] ?? responses[responses.length - 1];
    call += 1;
    const { status = 200, body } = responseConfig;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
};

describe("Mux integration helpers", () => {
  it("creates a direct upload with public playback policy", async () => {
    mockFetch([
      {
        body: {
          data: {
            id: "upload_123",
            url: "https://storage.mux.com/upload",
          },
        },
      },
    ]);

    const { uploadId, uploadUrl } = await createDirectUpload("Test Upload");

    expect(uploadId).toBe("upload_123");
    expect(uploadUrl).toBe("https://storage.mux.com/upload");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/video/v1/uploads"),
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, options] = (global.fetch as vi.Mock).mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: expect.stringMatching(/^Basic /),
    });
  });

  it("retrieves upload status and asset playback details", async () => {
    mockFetch([
      {
        body: {
          data: {
            id: "upload_123",
            asset_id: "asset_456",
            status: "asset_created",
            url: "https://storage.mux.com/upload",
          },
        },
      },
      {
        body: {
          data: {
            id: "asset_456",
            status: "ready",
            duration: 123.45,
            playback_ids: [
              { id: "pl_abc", policy: "public" },
            ],
          },
        },
      },
    ]);

    const upload = await getUploadStatus("upload_123");
    expect(upload.asset_id).toBe("asset_456");
    const asset = await getAsset(upload.asset_id!);
    expect(asset.status).toBe("ready");
    const playbackId = asset.playback_ids?.[0]?.id;
    expect(getMuxPlaybackUrl(playbackId!)).toBe("https://stream.mux.com/pl_abc.m3u8");
  });

  it("creates a live stream and returns ingest + playback details", async () => {
    mockFetch([
      {
        body: {
          data: {
            id: "ls_123",
            stream_key: "sk_789",
            status: "idle",
            playback_ids: [{ id: "pl_live", policy: "public" }],
            created_at: new Date().toISOString(),
            latency_mode: "standard",
          },
        },
      },
    ]);

    const stream = await createLiveStream("Test Stream");
    expect(stream.liveStreamId).toBe("ls_123");
    expect(stream.streamKey).toBe("sk_789");
    expect(stream.playbackUrl).toBe("https://stream.mux.com/pl_live.m3u8");
    expect(stream.rtmpIngestUrl).toBe("rtmp://global-live.mux.com:5222/app");
  });
});
