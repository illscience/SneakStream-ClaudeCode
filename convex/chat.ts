import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateImg2Vid } from "../lib/ai/fal";
import { api } from "./_generated/api";

export const sendMessage = mutation({
  args: {
    user: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    body: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
    remixOf: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      user: args.user,
      userId: args.userId,
      userName: args.userName,
      avatarUrl: args.avatarUrl,
      body: args.body,
      imageStorageId: args.imageStorageId,
      imageMimeType: args.imageMimeType,
      remixOf: args.remixOf,
    });
  },
});

export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").order("desc").take(50);

    const withUrls = await Promise.all(
      messages.map(async (message) => ({
        ...message,
        imageUrl: message.imageStorageId
          ? await ctx.storage.getUrl(message.imageStorageId)
          : undefined,
      }))
    );

    return withUrls.reverse();
  },
});

export const getMessageById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    if (message.imageStorageId) {
      await ctx.storage.delete(message.imageStorageId);
    }

    await ctx.db.delete(args.messageId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

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

    const { mediaUrl, isVideo } = await generateImg2Vid({
      imageUrl,
      prompt: args.prompt ?? "Remix animation",
      model,
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
    };
  },
});
