import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: {
    user: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      user: args.user,
      userId: args.userId,
      userName: args.userName,
      avatarUrl: args.avatarUrl,
      body: args.body,
    });
  },
});

export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").order("desc").take(50);
    return messages.reverse();
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message) {
      await ctx.db.delete(args.messageId);
    }
  },
});
