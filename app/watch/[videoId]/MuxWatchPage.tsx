"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, use, useState, useCallback } from "react";
import SyncedVideoPlayer from "../../components/SyncedVideoPlayer";
import { Eye, Calendar, Globe, Lock, Users, DollarSign } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { PPVGate } from "@/components/ppv";
import { TipButton } from "@/components/tips";

export default function MuxWatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isLoaded: authLoaded } = useAuth();
  const { videoId: videoIdString } = use(params);
  const videoId = videoIdString as Id<"videos">;

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  const video = useQuery(api.videos.getVideo, { videoId });
  const incrementViewCount = useMutation(api.videos.incrementViewCount);

  // Check bundled entitlement for PPV videos (includes linked livestream access)
  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    video?.visibility === "ppv" && userId ? { userId, videoId } : "skip"
  );

  // Show purchase success message
  const justPurchased = searchParams.get("purchased") === "true";

  // Fetch signed URL for PPV or signed playback policy videos
  const fetchSignedUrl = useCallback(async (forceRefresh = false) => {
    if (!video || (urlLoading && !forceRefresh)) return;

    const needsSignedUrl =
      (video.visibility === "ppv" && hasEntitlement) ||
      video.playbackPolicy === "signed";

    if (!needsSignedUrl) return;

    setUrlLoading(true);
    try {
      const response = await fetch("/api/playback/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSignedUrl(data.url);
      }
    } catch (error) {
      console.error("Failed to fetch signed URL:", error);
    } finally {
      setUrlLoading(false);
    }
  }, [video, hasEntitlement, videoId, urlLoading]);

  // Handle token expiration - refresh the signed URL
  const handleTokenExpired = useCallback(() => {
    console.log("[MuxWatchPage] Token expired, refreshing signed URL...");
    fetchSignedUrl(true);
  }, [fetchSignedUrl]);

  useEffect(() => {
    if (video && authLoaded) {
      fetchSignedUrl();
    }
  }, [video?._id, hasEntitlement, authLoaded]);

  useEffect(() => {
    if (video && (video.visibility !== "ppv" || hasEntitlement)) {
      incrementViewCount({ videoId });
    }
  }, [video?._id, hasEntitlement]);

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
          <button onClick={() => router.back()} className="mb-6 text-zinc-400 hover:text-white">
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
        <button onClick={() => router.back()} className="mb-6 text-zinc-400 hover:text-white">
          ← Back
        </button>

        {justPurchased && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-xl">
            <p className="text-green-400 font-medium">
              Purchase successful! Enjoy watching.
            </p>
          </div>
        )}

        <div className="mb-8">
          {video.visibility === "ppv" && video.price ? (
            <PPVGate
              videoId={video._id}
              videoTitle={video.title}
              price={video.price}
              thumbnailUrl={video.thumbnailUrl}
            >
              {(signedUrl || video.playbackUrl) ? (
                <div className="aspect-video bg-black rounded-2xl overflow-hidden">
                  <SyncedVideoPlayer
                    videoId={video._id}
                    videoTitle={video.title}
                    playbackUrl={signedUrl || video.playbackUrl!}
                    className="w-full h-full"
                    enableSync={false}
                    onTokenExpired={handleTokenExpired}
                  />
                </div>
              ) : urlLoading ? (
                <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center">
                  <p className="text-zinc-500">Loading video...</p>
                </div>
              ) : (
                <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center">
                  <p className="text-zinc-500">Playback URL unavailable</p>
                </div>
              )}
            </PPVGate>
          ) : video.playbackUrl ? (
            <div className="aspect-video bg-black rounded-2xl overflow-hidden">
              <SyncedVideoPlayer
                videoId={video._id}
                videoTitle={video.title}
                playbackUrl={signedUrl || video.playbackUrl}
                className="w-full h-full"
                enableSync={false}
                onTokenExpired={handleTokenExpired}
              />
            </div>
          ) : (
            <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center">
              <p className="text-zinc-500">Mux playback URL unavailable</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h1 className="text-3xl font-bold mb-4">{video.title}</h1>

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
                  ) : video.visibility === "ppv" ? (
                    <>
                      <DollarSign className="w-4 h-4" />
                      <span>Pay-Per-View</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Private</span>
                    </>
                  )}
                </div>
              </div>

              {video.description && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                  <p className="text-zinc-300 whitespace-pre-line">{video.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">Support DJ Sneak</h3>
              <TipButton videoId={video._id} className="w-full" />
            </div>

            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Playback info</h3>
              <div className="text-xs text-zinc-500 space-y-1 break-all">
                {video.playbackUrl && <p>HLS: {video.playbackUrl}</p>}
                {video.playbackId && <p>Playback ID: {video.playbackId}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
