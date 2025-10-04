"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Film, Plus, Play, Eye, Clock, RefreshCw, Trash2, Heart } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Header from "../components/Header";

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const videos = useQuery(
    api.videos.getUserVideos,
    user?.id ? { userId: user.id } : "skip"
  );

  const updateVideoStatus = useMutation(api.videos.updateVideoStatus);
  const deleteVideo = useMutation(api.videos.deleteVideo);

  const handleDelete = async (videoId: Id<"videos">, videoTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${videoTitle}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteVideo({ videoId });
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete video. Please try again.");
    }
  };

  const checkProcessingVideos = async () => {
    if (!videos) return;

    const processingVideos = videos.filter(
      (v) => v.status === "processing" || v.status === "uploading"
    );

    if (processingVideos.length === 0) return;

    setChecking(true);

    try {
      for (const video of processingVideos) {
        const response = await fetch("/api/upload/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId: video.livepeerAssetId,
          }),
        });

        if (response.ok) {
          const asset = await response.json();

          // Update based on Livepeer status
          if (asset.status?.phase === "ready") {
            // Construct playback URL if not provided
            const playbackUrl = asset.playbackUrl ||
              (asset.playbackId ? `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${asset.playbackId}/index.m3u8` : undefined);

            await updateVideoStatus({
              videoId: video._id,
              status: "ready",
              playbackId: asset.playbackId,
              playbackUrl: playbackUrl,
              thumbnailUrl: asset.staticMp4Url || undefined,
              duration: asset.videoSpec?.duration || undefined,
            });
          } else if (asset.status?.phase === "failed") {
            await updateVideoStatus({
              videoId: video._id,
              status: "failed",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking video status:", error);
    } finally {
      setChecking(false);
    }
  };

  // Auto-check processing videos on mount and every 10 seconds
  useEffect(() => {
    checkProcessingVideos();

    const interval = setInterval(() => {
      checkProcessingVideos();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [videos?.length]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header title="MY LIBRARY" />
      <div className="max-w-7xl mx-auto p-8 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">My Library</h1>
            <p className="text-zinc-400 mt-2">
              {videos?.length || 0} {videos?.length === 1 ? "video" : "videos"}
              {videos && videos.filter((v) => v.status === "processing" || v.status === "uploading").length > 0 && (
                <span className="ml-2 text-yellow-500">
                  ({videos.filter((v) => v.status === "processing" || v.status === "uploading").length} processing)
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            {videos?.some((v) => v.status === "processing" || v.status === "uploading") && (
              <button
                onClick={checkProcessingVideos}
                disabled={checking}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-full font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking..." : "Refresh Status"}
              </button>
            )}
            <Link href="/upload">
              <button className="flex items-center gap-2 px-6 py-3 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300 transition-colors">
                <Plus className="w-5 h-5" />
                Upload Video
              </button>
            </Link>
          </div>
        </div>

        {!videos || videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <Film className="w-12 h-12 text-zinc-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
            <p className="text-zinc-400 mb-6">Upload your first video to get started</p>
            <Link href="/upload">
              <button className="flex items-center gap-2 px-6 py-3 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300 transition-colors">
                <Plus className="w-5 h-5" />
                Upload Video
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video._id} className="relative group">
                <Link
                  href={`/watch/${video._id}`}
                  className="block"
                >
                  <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-lime-400 transition-all">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-zinc-800 flex items-center justify-center">
                      <Film className="w-16 h-16 text-zinc-600" />

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-lime-400 rounded-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-black ml-1" />
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            video.status === "ready"
                              ? "bg-green-500 text-white"
                              : video.status === "processing"
                              ? "bg-yellow-500 text-black"
                              : video.status === "uploading"
                              ? "bg-blue-500 text-white"
                              : "bg-red-500 text-white"
                          }`}
                        >
                          {video.status}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-bold mb-2 line-clamp-2 group-hover:text-lime-400 transition-colors">
                        {video.title}
                      </h3>
                      {video.description && (
                        <p className="text-sm text-zinc-500 mb-3 line-clamp-2">
                          {video.description}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {video.viewCount || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4 fill-current text-red-600" />
                          {video.heartCount || 0}
                        </div>
                        {video.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {Math.floor(video.duration / 60)}:
                            {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                          </div>
                        )}
                        <div className="flex-1 text-right">
                          <span className="px-2 py-1 bg-zinc-800 rounded text-xs">
                            {video.visibility}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(video._id, video.title);
                  }}
                  className="absolute top-3 left-3 w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Delete video"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
