"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Inbox, MessageSquare, UserPlus, Radio, X, Reply } from "lucide-react";

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
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case "follow":
      return <UserPlus className="w-4 h-4 text-[#c4ff0e]" />;
    case "reply":
      return <Reply className="w-4 h-4 text-purple-400" />;
    case "go_live":
      return <Radio className="w-4 h-4 text-red-500" />;
    default:
      return <Inbox className="w-4 h-4 text-zinc-400" />;
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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.getNotifications);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Track whether the drawer was opened (so we know to mark as read on close)
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      // Drawer just closed — mark all as read
      wasOpenRef.current = false;
      markAllAsRead();
    }
  }, [open, markAllAsRead]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative" ref={drawerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
        aria-label={
          unreadCount
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <Inbox className="w-5 h-5 text-white" />
        {typeof unreadCount === "number" && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 h-[28rem] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {notifications === undefined ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`flex items-start gap-2.5 px-4 py-3 border-b border-zinc-800/50 transition-colors ${
                      notification.isRead
                        ? "opacity-60"
                        : "bg-zinc-800/30"
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 pt-1.5">
                      {!notification.isRead ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#c4ff0e]" />
                      ) : (
                        <div className="w-1.5 h-1.5" />
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
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                          {(notification.fromUserName ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 leading-snug">
                        {notificationText(notification)}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
