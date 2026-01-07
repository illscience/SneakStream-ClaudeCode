import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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

    const clerkId = args.userId;
    if (clerkId) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .first();

      if (!existingUser) {
        const alias = args.userName || args.user || "User";
        await ctx.db.insert("users", {
          clerkId,
          alias,
          email: undefined,
          imageUrl: args.avatarUrl,
          selectedAvatar: args.avatarUrl,
        });
      }
    }
  },
});

const buildMessageWithLoves = async (ctx: { db: any; storage: any }, message: any) => {
  const loves = await ctx.db
    .query("messageLoves")
    .withIndex("by_message", (q: any) => q.eq("messageId", message._id))
    .collect();

  const sortedLoves = loves.sort((a: any, b: any) => b.createdAt - a.createdAt);
  const seenLovers = new Set<string>();
  const uniqueLoves = sortedLoves.filter((love: any) => {
    if (seenLovers.has(love.clerkId)) return false;
    seenLovers.add(love.clerkId);
    return true;
  });

  const recentLovers = await Promise.all(
    uniqueLoves.map(async (love: any) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", love.clerkId))
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
    loveCount: uniqueLoves.length,
    recentLovers,
  };
};

export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").order("desc").take(50);
    const withUrls = await Promise.all(messages.map((message) => buildMessageWithLoves(ctx, message)));
    return withUrls.reverse();
  },
});

export const getMessagesPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("messages")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(results.page.map((message) => buildMessageWithLoves(ctx, message)));

    return {
      ...results,
      page,
    };
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

        const sortedLoves = loves.sort((a, b) => b.createdAt - a.createdAt);
        const seenLovers = new Set<string>();
        const uniqueLoves = sortedLoves.filter((love) => {
          if (seenLovers.has(love.clerkId)) return false;
          seenLovers.add(love.clerkId);
          return true;
        });

        const recentLovers = await Promise.all(
          uniqueLoves.map(async (love) => {
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
          loveCount: uniqueLoves.length,
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
