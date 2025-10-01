"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Play, Eye, Clock } from "lucide-react";

export default function VideoFeed({ limit }: { limit?: number }) {
  const { user } = useUser();

  // Get videos from users the current user follows
  const followingVideos = useQuery(
    api.videos.getFollowingVideos,
    user?.id ? { userId: user.id, limit: limit || 10 } : "skip"
  );

  // Get public videos if not signed in or as fallback
  const publicVideos = useQuery(api.videos.getPublicVideos, {
    limit: limit || 10,
  });

  const videos = user ? followingVideos : publicVideos;

  if (!videos || videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-zinc-500 text-sm">No videos yet</p>
        <p className="text-zinc-600 text-xs mt-1">
          {user ? "Follow artists to see their videos here" : "Sign in to follow artists"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => (
        <Link
          key={video._id}
          href={`/watch/${video._id}`}
          className="block group"
        >
          <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-lime-400 transition-all">
            <div className="flex gap-3 p-3">
              {/* Thumbnail */}
              <div className="relative w-32 h-20 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-zinc-600" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 bg-lime-400 rounded-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-black ml-0.5" />
                  </div>
                </div>

                {/* Duration badge */}
                {video.duration && (
                  <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs">
                    {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, "0")}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2 group-hover:text-lime-400 transition-colors mb-1">
                  {video.title}
                </h4>
                {video.description && (
                  <p className="text-xs text-zinc-500 line-clamp-1 mb-2">
                    {video.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {video.viewCount || 0}
                  </div>
                  {video.status === "ready" && (
                    <span className="text-green-500">●</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
