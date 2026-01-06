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
      messages.map(async (message) => {
        const loves = await ctx.db
          .query("messageLoves")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        const recentLoves = loves
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3);

        const recentLovers = await Promise.all(
          recentLoves.map(async (love) => {
            const user = await ctx.db
              .query("users")
              .withIndex("by_clerk_id", (q) => q.eq("clerkId", love.clerkId))
              .first();

            return {
              clerkId: love.clerkId,
              alias: user?.alias ?? "Anonymous",
              avatarUrl: user?.selectedAvatar ?? user?.imageUrl ?? undefined,
            };
          })
        );

        return {
          ...message,
          imageUrl: message.imageStorageId
            ? await ctx.storage.getUrl(message.imageStorageId)
            : undefined,
          loveCount: loves.length,
          recentLovers,
        };
      })
    );

    return withUrls.reverse();
  },
});

export const getMessageLoves = query({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    return await Promise.all(
      args.messageIds.map(async (messageId) => {
        const loves = await ctx.db
          .query("messageLoves")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        const recentLoves = loves
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3);

        const recentLovers = await Promise.all(
          recentLoves.map(async (love) => {
            const user = await ctx.db
              .query("users")
              .withIndex("by_clerk_id", (q) => q.eq("clerkId", love.clerkId))
              .first();

            return {
              clerkId: love.clerkId,
              alias: user?.alias ?? "Anonymous",
              avatarUrl: user?.selectedAvatar ?? user?.imageUrl ?? undefined,
            };
          })
        );

        return {
          messageId,
          loveCount: loves.length,
          recentLovers,
        };
      })
    );
  },
});

export const loveMessage = mutation({
  args: {
    messageId: v.id("messages"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await ctx.db.insert("messageLoves", {
      messageId: args.messageId,
      clerkId: args.clerkId,
      createdAt: Date.now(),
    });
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
