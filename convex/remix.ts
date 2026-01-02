"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { generateImg2Vid } from "../lib/ai/fal";
import { parseGIF, decompressFrames } from "gifuct-js";
import { PNG } from "pngjs";

export const remixImageToGif = action({
  args: {
    messageId: v.id("messages"),
    prompt: v.optional(v.string()),
    modelOverride: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(api.chat.getMessageById, { messageId: args.messageId });
    if (!message) {
      throw new Error("Message not found");
    }

    const imageUrl = message.imageStorageId
      ? await ctx.storage.getUrl(message.imageStorageId)
      : undefined;
    if (!imageUrl) {
      throw new Error("Message has no image to remix");
    }

    const modelSetting = await ctx.runQuery(api.adminSettings.getSetting, { key: "img2vidModel" });

    const model =
      args.modelOverride ||
      (typeof modelSetting === "string" ? modelSetting : undefined) ||
      process.env.FAL_IMG2VID_MODEL ||
      "wan/v2.6/image-to-video";

    const needsFramePair = model.includes("first-last-frame-to-video");
    let firstFrameUrl: string | undefined;
    let lastFrameUrl: string | undefined;

    if (needsFramePair) {
      try {
        if (message.imageMimeType?.startsWith("image/gif")) {
          const gifRes = await fetch(imageUrl);
          if (!gifRes.ok) {
            throw new Error(`Failed to fetch GIF: ${gifRes.status}`);
          }
          const gifBuffer = await gifRes.arrayBuffer();
          const gif = parseGIF(gifBuffer);
          const frames = decompressFrames(gif, true);
          if (!frames.length) {
            throw new Error("No frames found in GIF");
          }

          const toPngBuffer = (frame: any) => {
            const { width, height } = frame.dims;
            if (width < 240 || height < 240) {
              throw new Error("Image dimensions are too small. Minimum dimensions are 240x240 pixels.");
            }
            const png = new PNG({ width, height });
            png.data.set(frame.patch);
            return PNG.sync.write(png);
          };

          const firstBuf = toPngBuffer(frames[0]);
          const lastBuf = toPngBuffer(frames[frames.length - 1]);

          const firstArray = new Uint8Array(firstBuf.byteLength);
          firstArray.set(firstBuf);
          const lastArray = new Uint8Array(lastBuf.byteLength);
          lastArray.set(lastBuf);
          const firstArrayBuffer = firstArray.buffer;
          const lastArrayBuffer = lastArray.buffer;

          const firstId = await ctx.storage.store(new Blob([firstArrayBuffer], { type: "image/png" }));
          const lastId = await ctx.storage.store(new Blob([lastArrayBuffer], { type: "image/png" }));
          firstFrameUrl = (await ctx.storage.getUrl(firstId)) ?? undefined;
          lastFrameUrl = (await ctx.storage.getUrl(lastId)) ?? undefined;
        } else {
          firstFrameUrl = imageUrl;
          lastFrameUrl = imageUrl;
        }
      } catch (err) {
        console.error("Failed to extract first/last frames", err);
        throw err instanceof Error ? err : new Error("Failed to extract first/last frames");
      }
    }

    const { mediaUrl, isVideo } = await generateImg2Vid({
      imageUrl,
      prompt: args.prompt ?? "Remix animation",
      model,
      firstFrameUrl,
      lastFrameUrl,
    });

    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`Failed to download generated media: ${mediaRes.status}`);
    }
    const buffer = new Uint8Array(await mediaRes.arrayBuffer());
    const contentType =
      mediaRes.headers.get("content-type") || (isVideo ? "video/mp4" : "image/gif");
    const storageId = await ctx.storage.store(new Blob([buffer], { type: contentType }));

    const remixUserName =
      args.userName || args.userId || message.userName || message.user || "Anonymous";

    await ctx.runMutation(api.chat.sendMessage, {
      user: args.userId ?? (message.user as string | undefined),
      userId: args.userId ?? (message.userId as string | undefined),
      userName: remixUserName,
      avatarUrl: args.avatarUrl ?? message.avatarUrl,
      body: args.prompt ?? "Remix",
      imageStorageId: storageId,
      imageMimeType: contentType,
      remixOf: args.messageId,
    });

    return {
      storageId,
      imageUrl: await ctx.storage.getUrl(storageId),
      imageMimeType: contentType,
      remixOf: args.messageId,
      body: args.prompt ?? "Remix",
    };
  },
});
