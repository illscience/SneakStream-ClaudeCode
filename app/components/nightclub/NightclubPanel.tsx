"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NightclubScene } from "./NightclubScene";
import NightclubConversationFeed from "./NightclubConversationFeed";
import { Loader2, Sparkles, UsersRound, MessageCircleHeart } from "lucide-react";

const spawnAvatar = async (prompt?: string) => {
  const response = await fetch("/api/nightclub/avatars", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Failed to release avatar: ${response.status}`);
  }

  return response.json();
};

const triggerEncounter = async (
  avatarA: Id<"nightclubAvatars">,
  avatarB: Id<"nightclubAvatars">
) => {
  await fetch("/api/nightclub/conversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ avatarA, avatarB }),
  });
};

export const NightclubPanel = () => {
  const avatars = useQuery(api.nightclub.getActiveAvatars, {});
  const [selectedId, setSelectedId] = useState<Id<"nightclubAvatars"> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingEncounterPairs, setPendingEncounterPairs] = useState<Set<string>>(new Set());

  const hydratedAvatars = useMemo(
    () => avatars?.filter((avatar) => avatar.imageUrl) ?? [],
    [avatars]
  );

  const handleRelease = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await spawnAvatar();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }, []);

  const handleEncounter = useCallback(
    (avatarA: Id<"nightclubAvatars">, avatarB: Id<"nightclubAvatars">) => {
      const key = avatarA < avatarB ? `${avatarA}:${avatarB}` : `${avatarB}:${avatarA}`;
      setPendingEncounterPairs((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        void triggerEncounter(avatarA, avatarB).finally(() => {
          setPendingEncounterPairs((current) => {
            const updated = new Set(current);
            updated.delete(key);
            return updated;
          });
        });
        return next;
      });
    },
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black via-zinc-950 to-black p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-lime-300">Nightclub Avatar Simulation</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Release AI-generated partygoers onto the dance floor. When avatars collide, they improvise a quick conversation in the feed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRelease}
              className="inline-flex items-center gap-2 rounded-full bg-lime-400 px-5 py-2 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-75"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Release Avatar
            </button>
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-wide text-zinc-400">
              <UsersRound className="h-4 w-4 text-lime-300" />
              {hydratedAvatars.length} on floor
            </span>
            {pendingEncounterPairs.size > 0 && (
              <span className="flex items-center gap-2 rounded-full border border-fuchsia-500/60 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
                <MessageCircleHeart className="h-4 w-4" />
                Generating chats…
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          {(avatars ?? []).map((avatar) => (
            <button
              key={avatar._id}
              onClick={() => setSelectedId(avatar._id)}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-fuchsia-400/40 bg-zinc-900"
            >
              {avatar.imageUrl ? (
                <img
                  src={avatar.imageUrl}
                  alt={avatar.aliasSnapshot}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-zinc-200">
                  {avatar.aliasSnapshot.slice(0, 2).toUpperCase()}
                </span>
              )}
              {selectedId === avatar._id && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-lime-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <NightclubScene
          avatars={avatars ?? []}
          onEncounter={handleEncounter}
          onSelect={setSelectedId}
          selectedId={selectedId}
          className="h-[460px]"
        />

        <div className="rounded-3xl border border-fuchsia-500/30 bg-black/70 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fuchsia-200">
            <MessageCircleHeart className="h-4 w-4" /> Conversation Feed
          </div>
          <NightclubConversationFeed />
        </div>
      </div>
    </div>
  );
};

export default NightclubPanel;
