import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUser, requireAdmin } from "./adminSettings";
import { createNotification } from "./notifications";

export const sendMessage = mutation({
  args: {
    body: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Get authenticated user from JWT
    const clerkId = await getAuthenticatedUser(ctx);

    // Look up user details from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    const messageId = await ctx.db.insert("messages", {
      user: user?.alias,
      userId: clerkId,
      userName: user?.alias ?? "User",
      avatarUrl: user?.selectedAvatar ?? user?.imageUrl,
      body: args.body,
      imageStorageId: args.imageStorageId,
      imageMimeType: args.imageMimeType,
      replyToId: args.replyToId,
    });

    // Parse @mentions and create notifications
    const mentions = args.body.match(/@(\w+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions.map((m) => m.slice(1)))];
      for (const alias of uniqueMentions) {
        const mentionedUser = await ctx.db
          .query("users")
          .withIndex("by_alias", (q) => q.eq("alias", alias))
          .first();
        if (mentionedUser) {
          await createNotification(ctx, {
            userId: mentionedUser.clerkId,
            type: "mention",
            fromUserId: clerkId,
            fromUserName: user?.alias ?? "User",
            fromAvatarUrl: user?.selectedAvatar ?? user?.imageUrl,
            messageId,
          });
        }
      }
    }

    // Create reply notification for the original message author
    if (args.replyToId) {
      const parentMessage = await ctx.db.get(args.replyToId);
      if (parentMessage?.userId) {
        await createNotification(ctx, {
          userId: parentMessage.userId,
          type: "reply",
          fromUserId: clerkId,
          fromUserName: user?.alias ?? "User",
          fromAvatarUrl: user?.selectedAvatar ?? user?.imageUrl,
          messageId,
        });
      }
    }

    // Create user record if it doesn't exist
    if (!user) {
      await ctx.db.insert("users", {
        clerkId,
        alias: "User",
        email: undefined,
        imageUrl: undefined,
        selectedAvatar: undefined,
      });
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

  // Fetch reply parent if this message is a reply
  let replyTo: { userName: string; body: string } | undefined;
  if (message.replyToId) {
    const parentMessage = await ctx.db.get(message.replyToId);
    if (parentMessage) {
      replyTo = {
        userName: parentMessage.userName ?? parentMessage.user ?? "Anonymous",
        body: parentMessage.body,
      };
    }
  }

  return {
    ...message,
    imageUrl: message.imageStorageId
      ? await ctx.storage.getUrl(message.imageStorageId)
      : undefined,
    loveCount: uniqueLoves.length,
    recentLovers,
    replyTo,
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
  },
  handler: async (ctx, args) => {
    // Get authenticated user from JWT
    const clerkId = await getAuthenticatedUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await ctx.db.insert("messageLoves", {
      messageId: args.messageId,
      clerkId,
      createdAt: Date.now(),
    });
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Only admins can delete messages
    await requireAdmin(ctx);

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
    // Require authentication to upload files
    await getAuthenticatedUser(ctx);

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});
