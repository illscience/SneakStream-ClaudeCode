import { describe, expect, it } from "vitest";
import {
  cancelDirectUpload,
  createDirectUpload,
  createLiveStream,
  deleteLiveStream,
  getUploadStatus,
} from "@/lib/mux";

const MUX_LIVE_TEST_VALUE = process.env.MUX_LIVE_TEST;
const RUN_LIVE_TESTS = MUX_LIVE_TEST_VALUE === "1";
const tokenId = process.env.MUX_TOKEN_ID || process.env.MUX_TOKEN;
const tokenSecret = process.env.MUX_TOKEN_SECRET || process.env.MUX_SECRET_KEY;
const hasTokens = Boolean(tokenId && tokenSecret);

if (RUN_LIVE_TESTS) {
  console.log("[mux.live.test] live suite enabled; tokens present?", tokenId ? "yes" : "no", tokenSecret ? "yes" : "no");
}

if (RUN_LIVE_TESTS && !hasTokens) {
  describe("Mux live API", () => {
    it("requires MUX_TOKEN_ID and MUX_TOKEN_SECRET when MUX_LIVE_TEST=1", () => {
      throw new Error("Set MUX_TOKEN_ID and MUX_TOKEN_SECRET (or MUX_TOKEN / MUX_SECRET_KEY) to run live Mux tests");
    });
  });
}

const maybeDescribe = RUN_LIVE_TESTS && hasTokens ? describe : describe.skip;

maybeDescribe("Mux live API", () => {
  it("creates and cancels a direct upload", async () => {
    const { uploadId, uploadUrl } = await createDirectUpload("Integration Upload Test");
    expect(typeof uploadId).toBe("string");
    expect(uploadId.length).toBeGreaterThan(10);
    expect(uploadUrl).toContain("https://");

    const status = await getUploadStatus(uploadId);
    expect(status.status).toBeDefined();

    try {
      await cancelDirectUpload(uploadId);
    } catch (error) {
      // Some accounts / uploads cannot be cancelled (e.g., already processed).
      console.warn("Skipping cancelDirectUpload error:", error);
    }
  });

  it("creates and deletes a live stream", async () => {
    try {
      const stream = await createLiveStream("Integration Stream Test");
      expect(typeof stream.liveStreamId).toBe("string");
      expect(stream.liveStreamId.length).toBeGreaterThan(10);
      expect(stream.streamKey).toBeTruthy();
      expect(stream.rtmpIngestUrl).toContain("rtmp://");

      if (stream.liveStreamId) {
        await deleteLiveStream(stream.liveStreamId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Live streams are unavailable")) {
        console.warn("Skipping live stream test: live streams unavailable on current plan");
        return;
      }
      throw error;
    }
  });
});

if (!RUN_LIVE_TESTS || !hasTokens) {
  describe.skip("Mux live API", () => {
    it("skipped because MUX_LIVE_TEST !== '1' or tokens missing", () => {
      // Intentionally skipped unless explicitly enabled.
    });
  });
}
