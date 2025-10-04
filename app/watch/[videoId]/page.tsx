"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import * as Player from "@livepeer/react/player";
import { useEffect, use } from "react";
import { Eye, Calendar, Globe, Lock, Users } from "lucide-react";

export default function WatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const router = useRouter();
  const { videoId: videoIdString } = use(params);
  const videoId = videoIdString as Id<"videos">;

  const video = useQuery(api.videos.getVideo, { videoId });
  const incrementViewCount = useMutation(api.videos.incrementViewCount);

  // Increment view count when video loads
  useEffect(() => {
    if (video) {
      incrementViewCount({ videoId });
      console.log("=== VIDEO PLAYBACK DEBUG ===");
      console.log("Video:", video);
      console.log("Playback URL:", video.playbackUrl);
      console.log("==========================");
    }
  }, [video?._id]);

  if (!video) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (video.status !== "ready") {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto p-8">
          <button
            onClick={() => router.back()}
            className="mb-6 text-zinc-400 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {video.status === "processing"
                ? "Processing Video"
                : video.status === "uploading"
                ? "Uploading Video"
                : "Video Unavailable"}
            </h2>
            <p className="text-zinc-400 mb-6">
              {video.status === "processing"
                ? "Your video is being processed. This may take a few minutes."
                : video.status === "uploading"
                ? "Your video is being uploaded. Please wait..."
                : "This video is not available for playback."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-zinc-400 hover:text-white"
        >
          ← Back
        </button>

        {/* Video Player */}
        <div className="mb-8">
          {video.playbackUrl || video.playbackId ? (
            <div className="aspect-video bg-black rounded-2xl overflow-hidden">
              <Player.Root
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                src={video.playbackUrl || `https://livepeer.studio/api/playback/${video.playbackId}` as any}
                autoPlay={true}
              >
                <Player.Container>
                  <Player.Video className="w-full h-full" />
                  <Player.Controls className="flex items-center gap-2 p-4">
                    <Player.PlayPauseTrigger />
                    <Player.Time />
                    <Player.Seek className="flex-1" />
                    <Player.Volume />
                    <Player.FullscreenTrigger />
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            </div>
          ) : (
            <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center">
              <p className="text-zinc-500">Video player unavailable</p>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="grid grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="col-span-2">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h1 className="text-3xl font-bold mb-4">{video.title}</h1>

              {/* Meta */}
              <div className="flex items-center gap-6 mb-6 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>{video.viewCount || 0} views</span>
                </div>
                {video.duration && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {Math.floor(video.duration / 60)}:
                      {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {video.visibility === "public" ? (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>Public</span>
                    </>
                  ) : video.visibility === "followers" ? (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Followers</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Private</span>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {video.description && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    Description
                  </h3>
                  <p className="text-zinc-300 whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h3 className="font-bold mb-4">Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-zinc-500 mb-1">Status</p>
                  <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
                    {video.status}
                  </span>
                </div>
                {video.livepeerAssetId && (
                  <div>
                    <p className="text-zinc-500 mb-1">Asset ID</p>
                    <p className="text-zinc-400 text-xs font-mono break-all">
                      {video.livepeerAssetId}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
