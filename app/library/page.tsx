"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Film, Plus, Play, Eye, Clock, RefreshCw, Heart, Edit2, Check, X, Radio, Download, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import MainNav from "@/components/navigation/MainNav";

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<Id<"videos"> | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const [requestingDownload, setRequestingDownload] = useState<Id<"videos"> | null>(null);
  const [invalidAssetIds, setInvalidAssetIds] = useState<string[]>([]);
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? {} : "skip"
  );

  const videos = useQuery(
    api.videos.getAdminLibraryVideos,
    isAdmin ? undefined : "skip"
  );

  const updateVideoStatus = useMutation(api.videos.updateVideoStatus);
  const updateVideo = useMutation(api.videos.updateVideo);
  const playNow = useMutation(api.playlist.playNow);
  const playNext = useMutation(api.playlist.playNext);
  const clearExpiredMasters = useMutation(api.videos.clearExpiredMasters);

  // Get current default video to show "ON AIR NOW" indicator
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  // Check for duplicate asset IDs (data integrity warning)
  const duplicateAssetWarnings = useMemo(() => {
    if (!videos) return [];

    const assetIdMap = new Map<string, Array<{ id: Id<"videos">; title: string }>>();

    for (const video of videos) {
      if (video.assetId) {
        const existing = assetIdMap.get(video.assetId) || [];
        existing.push({ id: video._id, title: video.title });
        assetIdMap.set(video.assetId, existing);
      }
    }

    const duplicates: Array<{ assetId: string; videos: Array<{ id: Id<"videos">; title: string }> }> = [];
    for (const [assetId, vids] of assetIdMap) {
      if (vids.length > 1) {
        duplicates.push({ assetId, videos: vids });
      }
    }

    return duplicates;
  }, [videos]);

  const assetIdsForValidation = useMemo(() => {
    if (!videos) return [];
    const ids = new Set<string>();
    for (const video of videos) {
      if (video.provider === "mux" && video.assetId) {
        ids.add(video.assetId);
      }
    }
    return Array.from(ids);
  }, [videos]);

  const invalidAssetSet = useMemo(() => new Set(invalidAssetIds), [invalidAssetIds]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePlayNow = async (videoId: Id<"videos">, videoTitle: string) => {
    if (!user?.id) return;

    // Confirmation dialog to prevent accidental interruption
    const confirmed = confirm(
      `Play "${videoTitle}" now?\n\nThis will immediately switch all viewers to this video.`
    );

    if (!confirmed) return;

    try {
      await playNow({ videoId });
      showNotification(`Now playing: ${videoTitle}`);
    } catch (error) {
      console.error("Play now error:", error);
      alert("Failed to play video. Please try again.");
    }
  };

  const handlePlayNext = async (videoId: Id<"videos">, videoTitle: string) => {
    if (!user?.id) return;
    try {
      await playNext({ videoId });
      showNotification(`"${videoTitle}" added to queue`);
    } catch (error) {
      console.error("Play next error:", error);
      alert("Failed to queue video. Please try again.");
    }
  };

  const handleStartEdit = (videoId: Id<"videos">, currentTitle: string) => {
    setEditingVideoId(videoId);
    setEditingTitle(currentTitle);
  };

  const handleSaveEdit = async (videoId: Id<"videos">) => {
    try {
      await updateVideo({
        videoId,
        title: editingTitle,
      });
      setEditingVideoId(null);
      setEditingTitle("");
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update title. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditingVideoId(null);
    setEditingTitle("");
  };

  // Request download - POST to API, sets status to "preparing"
  const handleRequestDownload = async (videoId: Id<"videos">, videoTitle: string) => {
    if (requestingDownload === videoId) return;

    setRequestingDownload(videoId);

    try {
      const response = await fetch("/api/video/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Download service unavailable. Please try again.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to request download");
      }

      if (result.status === "ready" && result.downloadUrl) {
        // Already ready, open immediately
        window.open(result.downloadUrl, "_blank");
        showNotification(`Download started: ${videoTitle}`);
      } else {
        // Preparing - Convex will update the status, UI will show spinner
        showNotification(`Preparing download: ${videoTitle}`);
      }
    } catch (error) {
      console.error("Download request error:", error);
      alert(`Failed to request download: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRequestingDownload(null);
    }
  };

  // Open download URL for a video that's already ready
  const handleOpenDownload = (masterUrl: string, videoTitle: string) => {
    window.open(masterUrl, "_blank");
    showNotification(`Download started: ${videoTitle}`);
  };

  // Clear expired masters on mount
  useEffect(() => {
    if (videos && videos.length > 0 && isAdmin) {
      const expiredVideoIds = videos
        .filter((v) => v.masterExpiresAt && v.masterExpiresAt < Date.now())
        .map((v) => v._id);

      if (expiredVideoIds.length > 0) {
        clearExpiredMasters({ videoIds: expiredVideoIds });
      }
    }
  }, [videos, isAdmin, clearExpiredMasters]);

  // Refresh status of "preparing" downloads on page load (in case webhook was missed)
  useEffect(() => {
    if (!videos || !isAdmin) return;

    const preparingVideos = videos.filter(
      (v) => v.masterStatus === "preparing" && v.assetId
    );

    if (preparingVideos.length === 0) return;

    // Check each preparing video via the API (which will update Convex if ready)
    const refreshPreparingDownloads = async () => {
      console.log(`[Library] Refreshing ${preparingVideos.length} preparing download(s)...`);
      for (const video of preparingVideos) {
        try {
          const response = await fetch(`/api/video/download?videoId=${video._id}`);
          if (response.ok) {
            const result = await response.json();
            if (result.status === "ready") {
              showNotification(`Download ready: ${video.title}`);
            }
          }
        } catch (error) {
          console.error(`[Library] Failed to refresh ${video._id}:`, error);
        }
      }
    };

    refreshPreparingDownloads();
    // Only run once on mount when videos first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos?.length, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (assetIdsForValidation.length === 0) {
      setInvalidAssetIds([]);
      return;
    }

    let cancelled = false;
    const validateAssets = async () => {
      try {
        const response = await fetch("/api/video/validate-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetIds: assetIdsForValidation }),
        });

        if (!response.ok) return;
        const result = await response.json();
        if (!cancelled && Array.isArray(result.invalid)) {
          setInvalidAssetIds(result.invalid);
        }
      } catch (error) {
        console.warn("Asset validation failed:", error);
      }
    };

    validateAssets();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, assetIdsForValidation]);

  const checkProcessingVideos = async () => {
    if (!videos) return;

    const processingVideos = videos.filter(
      (v) => v.status === "processing" || v.status === "uploading"
    );

    if (processingVideos.length === 0) return;

    setChecking(true);

    try {
      for (const video of processingVideos) {
        const payload =
          video.provider === "mux"
            ? video.uploadId
              ? { uploadId: video.uploadId, provider: "mux" }
              : { assetId: video.assetId, provider: "mux" }
            : { assetId: video.assetId, provider: "livepeer" };

        if (!payload.uploadId && !payload.assetId) {
          continue;
        }

        const response = await fetch("/api/upload/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          continue;
        }

        const asset = await response.json();

        if (video.provider === "mux") {
          if (asset.assetStatus === "ready") {
            await updateVideoStatus({
              videoId: video._id,
              status: "ready",
              playbackId: asset.playbackId || undefined,
              playbackUrl: asset.playbackUrl || undefined,
              duration: asset.duration || undefined,
              progress: 1,
            });
          } else if (asset.status === "errored") {
            await updateVideoStatus({ videoId: video._id, status: "failed" });
          }
        } else {
          if (asset.status?.phase === "ready") {
            const playbackUrl =
              asset.playbackUrl ||
              (asset.playbackId
                ? `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${asset.playbackId}/index.m3u8`
                : undefined);

            await updateVideoStatus({
              videoId: video._id,
              status: "ready",
              playbackId: asset.playbackId,
              playbackUrl,
              thumbnailUrl: asset.staticMp4Url || undefined,
              duration: asset.videoSpec?.duration || undefined,
              progress: 1.0,
            });
          } else if (asset.status?.phase === "processing") {
            await updateVideoStatus({
              videoId: video._id,
              status: "processing",
              progress: asset.status?.progress || 0,
            });
          } else if (asset.status?.phase === "failed") {
            await updateVideoStatus({ videoId: video._id, status: "failed" });
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

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  // Helper to determine download button state for a video
  const getDownloadState = (video: NonNullable<typeof videos>[number]) => {
    if (video.provider !== "mux" || !video.assetId || video.status !== "ready") {
      return { show: false };
    }

    if (video.masterStatus === "preparing") {
      return { show: true, state: "preparing" as const };
    }

    if (
      video.masterStatus === "ready" &&
      video.masterUrl &&
      video.masterExpiresAt &&
      video.masterExpiresAt > Date.now()
    ) {
      return { show: true, state: "ready" as const, url: video.masterUrl };
    }

    return { show: true, state: "idle" as const };
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-lime-400 text-black px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
            {notification}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-8 pt-24">
        {/* Duplicate Asset ID Warning */}
        {duplicateAssetWarnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-500">Duplicate Asset IDs Detected</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  The following videos reference the same underlying Mux asset. This may indicate a data issue:
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {duplicateAssetWarnings.map(({ assetId, videos }) => (
                    <li key={assetId} className="text-zinc-300">
                      <span className="font-mono text-xs text-yellow-500/80">{assetId.slice(0, 12)}...</span>
                      {" → "}
                      {videos.map((v, i) => (
                        <span key={v.id}>
                          {i > 0 && ", "}
                          <span className="text-white">{v.title}</span>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">My Library</h1>
              <p className="text-zinc-400 mt-2 text-sm md:text-base">
                {videos?.length || 0} {videos?.length === 1 ? "video" : "videos"}
                {videos && videos.filter((v) => v.status === "processing" || v.status === "uploading").length > 0 && (
                  <span className="ml-2 text-yellow-500">
                    ({videos.filter((v) => v.status === "processing" || v.status === "uploading").length} processing)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {videos?.some((v) => v.status === "processing" || v.status === "uploading") && (
              <button
                onClick={checkProcessingVideos}
                disabled={checking}
                className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-zinc-800 text-white rounded-full text-sm md:text-base font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${checking ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{checking ? "Checking..." : "Refresh Status"}</span>
                <span className="sm:hidden">Refresh</span>
              </button>
            )}
            <Link href="/upload">
              <button className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-lime-400 text-black rounded-full text-sm md:text-base font-medium hover:bg-lime-300 transition-colors">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">Upload Video</span>
                <span className="sm:hidden">Upload</span>
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
            {videos.map((video) => {
              const downloadState = getDownloadState(video);
              const isInvalidAsset =
                video.provider === "mux" &&
                video.status === "ready" &&
                !!video.assetId &&
                !video.assetId.startsWith("pending:") &&
                invalidAssetSet.has(video.assetId);

              return (
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
                        <div className="absolute top-3 right-3 flex gap-2">
                          {isInvalidAsset && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              INVALID ASSET
                            </span>
                          )}
                          {defaultVideo?._id === video._id && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-lime-400 text-black flex items-center gap-1">
                              <Radio className="w-3 h-3" />
                              ON AIR NOW
                            </span>
                          )}
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
                            {video.status === "processing" && video.progress !== undefined
                              ? `${Math.round((video.progress || 0) * 100)}%`
                              : video.status}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        {(video.status === "processing" || video.status === "uploading") && video.progress !== undefined && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
                            <div
                              className="h-full bg-lime-400 transition-all duration-300"
                              style={{ width: `${(video.progress || 0) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        {editingVideoId === video._id ? (
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-lime-400"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(video._id);
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(video._id)}
                              className="w-8 h-8 bg-lime-400 hover:bg-lime-500 rounded flex items-center justify-center"
                              title="Save"
                            >
                              <Check className="w-4 h-4 text-black" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ) : (
                          <div className="mb-2 flex items-center gap-2 group/title">
                            <h3 className="flex-1 font-bold line-clamp-2 group-hover:text-lime-400 transition-colors">
                              {video.title}
                            </h3>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleStartEdit(video._id, video.title);
                              }}
                              className="opacity-0 group-hover/title:opacity-100 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center transition-opacity"
                              title="Edit title"
                            >
                              <Edit2 className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        )}
                        {video.description && (
                          <p className="text-sm text-zinc-500 mb-3 line-clamp-2">
                            {video.description}
                          </p>
                        )}
                        {(video.uploaderAlias || video.uploadedBy) && (
                          <p className="text-xs text-zinc-500 mb-3">
                            Uploaded by: {video.uploaderAlias || video.uploadedBy}
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
                        <div className="mt-2 text-[10px] text-zinc-500 space-y-0.5">
                          <div className="uppercase">
                            Provider: {video.provider === "mux" ? "Mux" : "Livepeer"}
                          </div>
                          {video.assetId && (
                            <div className="font-mono text-zinc-600 truncate" title={video.assetId}>
                              Asset: {video.assetId}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Action Buttons - Always visible on mobile, hover on desktop */}
                  <div className="absolute top-3 left-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                    {/* Play Now Button */}
                    {video.status === "ready" && defaultVideo?._id !== video._id && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handlePlayNow(video._id, video.title);
                        }}
                        className="w-10 h-10 bg-lime-400/90 hover:bg-lime-500 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-black"
                        title="Play Now - Switch all viewers to this video immediately"
                      >
                        <Radio className="w-5 h-5" />
                      </button>
                    )}

                    {/* Play Next Button */}
                    {video.status === "ready" && defaultVideo?._id !== video._id && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handlePlayNext(video._id, video.title);
                        }}
                        className="w-10 h-10 bg-blue-600/90 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-white"
                        title="Play Next - Add to queue"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    )}

                    {/* Download Button - Different states */}
                    {downloadState.show && downloadState.state === "preparing" && (
                      <button
                        disabled
                        className="w-10 h-10 bg-purple-600/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-white opacity-80"
                        title="Preparing download..."
                      >
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </button>
                    )}

                    {downloadState.show && downloadState.state === "ready" && downloadState.url && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenDownload(downloadState.url!, video.title);
                        }}
                        className="w-10 h-10 bg-green-600/90 hover:bg-green-700 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-white"
                        title="Download Ready - Click to download"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}

                    {downloadState.show && downloadState.state === "idle" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleRequestDownload(video._id, video.title);
                        }}
                        disabled={requestingDownload === video._id}
                        className="w-10 h-10 bg-purple-600/90 hover:bg-purple-700 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-white disabled:opacity-50"
                        title="Download original video"
                      >
                        {requestingDownload === video._id ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
