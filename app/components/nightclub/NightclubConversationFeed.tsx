"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import clsx from "clsx";

interface NightclubConversationFeedProps {
  focusedEncounterId?: Id<"nightclubEncounters"> | null;
  className?: string;
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const NightclubConversationFeed = ({ focusedEncounterId, className }: NightclubConversationFeedProps) => {
  const encounters = useQuery(api.nightclub.getRecentEncounters, { limit: 20 });

  const avatarIds = useMemo(() => {
    const ids = new Set<Id<"nightclubAvatars">>();
    encounters?.forEach((encounter) => {
      ids.add(encounter.avatarA);
      ids.add(encounter.avatarB);
    });
    return Array.from(ids);
  }, [encounters]);

  const avatars = useQuery(api.nightclub.getAvatarsByIds, {
    avatarIds,
  });

  const avatarMap = useMemo(() => {
    const map = new Map<Id<"nightclubAvatars">, (typeof avatars)[number]>();
    avatars?.forEach((avatar) => {
      map.set(avatar._id, avatar);
    });
    return map;
  }, [avatars]);

  if (!encounters?.length) {
    return (
      <div className={clsx("rounded-2xl border border-white/5 bg-black/60 p-6 text-center text-sm text-zinc-400", className)}>
        No AI encounters yet. Release avatars to spark conversations.
      </div>
    );
  }

  return (
    <div className={clsx("space-y-4", className)}>
      {encounters.map((encounter) => {
        const avatarA = avatarMap.get(encounter.avatarA);
        const avatarB = avatarMap.get(encounter.avatarB);
        const isFocused = focusedEncounterId === encounter._id;

        return (
          <div
            key={encounter._id}
            className={clsx(
              "rounded-3xl border bg-gradient-to-br from-fuchsia-500/0 via-black to-black px-5 py-4 shadow-lg transition-opacity",
              isFocused ? "border-lime-400/80" : "border-fuchsia-500/40"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex -space-x-2">
                {[avatarA, avatarB].map((avatar, index) => (
                  <div
                    key={avatar?._id ?? index}
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-fuchsia-300/60 bg-zinc-900"
                  >
                    {avatar?.imageUrl ? (
                      <img
                        src={avatar.imageUrl}
                        alt={avatar.aliasSnapshot}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-fuchsia-100">
                        {(avatar?.aliasSnapshot ?? "?").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-fuchsia-300">
                  <span>
                    {avatarA?.aliasSnapshot ?? "Unknown"} ↔ {avatarB?.aliasSnapshot ?? "Unknown"}
                  </span>
                  <span className="text-zinc-500">{formatTime(encounter.startedAt)}</span>
                </div>

                {encounter.summary && (
                  <p className="text-sm font-medium text-lime-300">{encounter.summary}</p>
                )}

                {encounter.transcript && (
                  <pre className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/50 p-3 text-xs text-zinc-200">
                    {encounter.transcript}
                  </pre>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NightclubConversationFeed;
