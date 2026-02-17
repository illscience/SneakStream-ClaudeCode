import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./adminSettings";
import type { Id } from "./_generated/dataModel";

// Get notifications for the current user, newest first
export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUser(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return notifications;
  },
});

// Get count of unread notifications for the current user
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUser(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

// Mark all unread notifications as read for the current user
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUser(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { isRead: true });
    }

    return { marked: unread.length };
  },
});

// Internal helper — creates a notification record.
// Skips if userId === fromUserId (don't notify yourself).
export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: string;
    type: "mention" | "follow" | "go_live" | "reply";
    fromUserId?: string;
    fromUserName?: string;
    fromAvatarUrl?: string;
    messageId?: Id<"messages">;
    livestreamId?: Id<"livestreams">;
  }
) {
  // Don't notify yourself
  if (args.fromUserId && args.userId === args.fromUserId) {
    return null;
  }

  return await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    isRead: false,
    createdAt: Date.now(),
    fromUserId: args.fromUserId,
    fromUserName: args.fromUserName,
    fromAvatarUrl: args.fromAvatarUrl,
    messageId: args.messageId,
    livestreamId: args.livestreamId,
  });
}
