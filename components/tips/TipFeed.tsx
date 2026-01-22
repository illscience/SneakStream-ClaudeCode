"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TipFeedProps {
  livestreamId?: Id<"livestreams">;
  videoId?: Id<"videos">;
  className?: string;
  maxItems?: number;
}

const EMOJI_MAP: Record<string, string> = {
  fire: "🔥",
  heart: "❤️",
  rocket: "🚀",
  clap: "👏",
};

interface TipNotification {
  id: string;
  senderName: string;
  amount: number;
  message?: string;
  emoji?: string;
  createdAt: number;
  isNew?: boolean;
}

export function TipFeed({
  livestreamId,
  videoId,
  className,
  maxItems = 5,
}: TipFeedProps) {
  const [notifications, setNotifications] = useState<TipNotification[]>([]);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  const tips = useQuery(api.tips.getRecentTips, {
    limit: maxItems,
    livestreamId,
    videoId,
  });

  useEffect(() => {
    if (!tips || tips.length === 0) return;

    const latestTip = tips[0];
    const latestId = latestTip._id;

    // Check if we have a new tip
    if (lastSeenId && latestId !== lastSeenId) {
      // Find all new tips
      const newTips = tips.filter((tip) => {
        // This is a simplification - in production you'd track seen IDs properly
        return tip.createdAt > (notifications[0]?.createdAt || 0);
      });

      if (newTips.length > 0) {
        setNotifications((prev) => {
          const newNotifications: TipNotification[] = newTips.map((tip) => ({
            id: tip._id,
            senderName: tip.senderName,
            amount: tip.amount,
            message: tip.message,
            emoji: tip.emoji,
            createdAt: tip.createdAt,
            isNew: true,
          }));
          return [...newNotifications, ...prev].slice(0, maxItems);
        });

        // Clear the "new" flag after animation
        setTimeout(() => {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, isNew: false }))
          );
        }, 3000);
      }
    } else if (!lastSeenId) {
      // Initial load - don't animate
      setNotifications(
        tips.map((tip) => ({
          id: tip._id,
          senderName: tip.senderName,
          amount: tip.amount,
          message: tip.message,
          emoji: tip.emoji,
          createdAt: tip.createdAt,
          isNew: false,
        }))
      );
    }

    setLastSeenId(latestId);
  }, [tips, lastSeenId, notifications, maxItems]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "rounded-lg bg-background/80 backdrop-blur-sm border px-3 py-2 shadow-lg transition-all duration-300",
            notification.isNew && "animate-in slide-in-from-right-5 fade-in"
          )}
        >
          <div className="flex items-center gap-2">
            {notification.emoji && (
              <span className="text-lg">
                {EMOJI_MAP[notification.emoji] || notification.emoji}
              </span>
            )}
            <span className="font-medium text-sm">
              {notification.senderName}
            </span>
            <span className="text-primary font-bold text-sm">
              ${(notification.amount / 100).toFixed(2)}
            </span>
          </div>
          {notification.message && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
