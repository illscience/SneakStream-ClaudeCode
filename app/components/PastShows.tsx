"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Clock, Lock, Play, Check } from "lucide-react";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getThumbnailUrl(video: {
  thumbnailUrl?: string;
  playbackId?: string;
  provider?: string;
}): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.playbackId && video.provider === "mux") {
    return `https://image.mux.com/${video.playbackId}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`;
  }
  return null;
}

function PastShowCard({
  video,
  userId,
}: {
  video: {
    _id: Id<"videos">;
    title: string;
    description?: string;
    duration?: number;
    visibility: string;
    price?: number;
    thumbnailUrl?: string;
    playbackId?: string;
    provider?: string;
    viewCount?: number;
    heartCount?: number;
  };
  userId: string | null | undefined;
}) {
  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    userId ? { userId, videoId: video._id } : "skip"
  );

  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    userId ? {} : "skip"
  );

  const isVIP = useQuery(
    api.users.isCurrentUserVIP,
    userId ? {} : "skip"
  );

  const hasAccess = hasEntitlement || isAdmin || isVIP;
  const thumbnail = getThumbnailUrl(video);
  const price = video.price ?? 0;

  return (
    <Link
      href={`/watch/${video._id}`}
      className="group bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/50"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-12 h-12 text-zinc-600" />
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            <Play className="w-7 h-7 text-black ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Access / price badge */}
        {userId && hasAccess ? (
          <div className="absolute top-2 left-2 bg-lime-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Check className="w-3 h-3" />
            Owned
          </div>
        ) : (
          <div className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Lock className="w-3 h-3" />
            ${(price / 100).toFixed(2)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-lime-400 transition-colors">
          {video.title}
        </h3>
        {video.description && (
          <p className="text-zinc-500 text-xs mt-1 line-clamp-1">
            {video.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
          {video.viewCount !== undefined && video.viewCount > 0 && (
            <span>{video.viewCount.toLocaleString()} views</span>
          )}
          {video.heartCount !== undefined && video.heartCount > 0 && (
            <span>♥ {video.heartCount.toLocaleString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function PastShows() {
  const { userId } = useAuth();
  const pastShows = useQuery(api.videos.getPastShows, { limit: 6 });

  if (pastShows === undefined) {
    return (
      <div className="px-4 lg:px-8 py-8">
        <div className="flex justify-center">
          <div className="max-w-6xl w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-video bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pastShows.length === 0) {
    return (
      <div className="px-4 lg:px-8 py-16">
        <div className="flex justify-center">
          <div className="max-w-6xl w-full text-center">
            <div className="text-4xl mb-3">🎧</div>
            <h3 className="text-xl font-bold text-white mb-2">No Past Shows Yet</h3>
            <p className="text-zinc-400">Check back after the next live session.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-8">
      <div className="flex justify-center">
        <div className="max-w-6xl w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastShows.map((video) => (
              <PastShowCard key={video._id} video={video} userId={userId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
