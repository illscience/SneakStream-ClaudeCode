import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: {
    user: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    body: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
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
