"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { MessageSquare, UserPlus, Radio, Bell, Reply } from "lucide-react";
import MainNav from "@/components/navigation/MainNav";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "mention":
      return <MessageSquare className="w-5 h-5 text-blue-400" />;
    case "follow":
      return <UserPlus className="w-5 h-5 text-[#c4ff0e]" />;
    case "reply":
      return <Reply className="w-5 h-5 text-purple-400" />;
    case "go_live":
      return <Radio className="w-5 h-5 text-red-500" />;
    default:
      return <Bell className="w-5 h-5 text-zinc-400" />;
  }
}

function notificationText(notification: {
  type: string;
  fromUserName?: string;
}) {
  const name = notification.fromUserName ?? "Someone";
  switch (notification.type) {
    case "mention":
      return (
        <>
          <span className="font-semibold text-white">{name}</span>{" "}
          mentioned you in chat
        </>
      );
    case "follow":
      return (
        <>
          <span className="font-semibold text-white">{name}</span>{" "}
          followed you
        </>
      );
    case "reply":
      return (
        <>
          <span className="font-semibold text-white">{name}</span>{" "}
          replied to your message
        </>
      );
    case "go_live":
      return (
        <>
          <span className="font-semibold text-white">{name}</span>{" "}
          went live
        </>
      );
    default:
      return "New notification";
  }
}

export default function NotificationsPage() {
  const { user, isLoaded } = useUser();
  const notifications = useQuery(
    api.notifications.getNotifications,
    user?.id ? {} : "skip"
  );
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Mark all as read on mount
  useEffect(() => {
    if (user?.id && notifications && notifications.some((n) => !n.isRead)) {
      markAllAsRead();
    }
  }, [user?.id, notifications, markAllAsRead]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav />
        <main className="pt-24 px-4 lg:px-8 pb-16 max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-zinc-900 rounded-xl"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav />
        <main className="pt-24 px-4 lg:px-8 pb-16 max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-2">Sign in to view notifications</h1>
          <p className="text-zinc-400">You need to be signed in to see your notifications.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav />
      <main className="pt-24 px-4 lg:px-8 pb-16 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>

        {notifications === undefined ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-zinc-900 rounded-xl"
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg">No notifications yet</p>
            <p className="text-zinc-600 text-sm mt-1">
              You&apos;ll be notified when someone mentions you, follows you, or goes live.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                  notification.isRead
                    ? "bg-zinc-900/50 border-zinc-800/50 opacity-70"
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                {/* Unread indicator */}
                <div className="flex-shrink-0 pt-1">
                  {!notification.isRead ? (
                    <div className="w-2 h-2 rounded-full bg-[#c4ff0e]" />
                  ) : (
                    <div className="w-2 h-2" />
                  )}
                </div>

                {/* Type icon */}
                <div className="flex-shrink-0 pt-0.5">
                  <NotificationIcon type={notification.type} />
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {notification.fromAvatarUrl ? (
                    <img
                      src={notification.fromAvatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                      {(notification.fromUserName ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">
                    {notificationText(notification)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
