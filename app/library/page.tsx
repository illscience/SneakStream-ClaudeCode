"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Film, Plus, Play, Eye, Clock, RefreshCw, Trash2, Heart, Edit2, Check, X, SkipForward, Radio } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import MainNav from "@/components/navigation/MainNav";

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<Id<"videos"> | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
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

  // Get current default video to show "ON AIR NOW" indicator
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

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

  const handleDelete = async (videoId: Id<"videos">, videoTitle: string, force = false, crateCount = 0) => {
    const confirmMessage = force
      ? `FORCE DELETE "${videoTitle}"?\n\nThis will:\n- Delete the video from Mux\n- Remove ${crateCount} crate purchase${crateCount === 1 ? '' : 's'} from users\n\nThis cannot be undone!`
      : `Are you sure you want to delete "${videoTitle}"?\n\nThis will also delete the video from Mux and cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch("/api/video/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, force }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if blocked by crate purchases safeguard
        if (response.status === 409 && result.requiresForce) {
          const count = result.crateCount || 0;
          const forceConfirm = confirm(
            `Cannot delete "${videoTitle}"\n\n` +
            `This recording has ${count} crate purchase${count === 1 ? '' : 's'} associated with it.\n\n` +
            `Do you want to FORCE DELETE?\n` +
            `This will permanently remove ${count === 1 ? 'this purchase' : `these ${count} purchases`} from users' crates.`
          );

          if (forceConfirm) {
            // Retry with force=true
            await handleDelete(videoId, videoTitle, true, count);
          }
          return;
        }
        throw new Error(result.error || "Failed to delete video");
      }

      console.log("Video deleted successfully");
      showNotification(`"${videoTitle}" deleted`);
    } catch (error) {
      console.error("Delete error:", error);
      alert(`Failed to delete video: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  const syncRecordings = async () => {
    setSyncing(true);

    try {
      const response = await fetch("/api/stream/import-mux-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (result.success) {
        const { summary, skipped, errors } = result;
        let message = `Import complete!\n\n` +
          `Total Mux assets scanned: ${summary.totalAssets}\n` +
          `Assets imported: ${summary.assetsImported}\n` +
          `Assets skipped: ${summary.assetsSkipped}\n` +
          `Errors: ${summary.errors}\n\n`;

        // Show skip reasons (first 5)
        if (skipped && skipped.length > 0) {
          message += `\nSkip reasons:\n`;
          const reasonCounts: Record<string, number> = {};
          skipped.forEach((skip: { reason: string }) => {
            reasonCounts[skip.reason] = (reasonCounts[skip.reason] || 0) + 1;
          });
          Object.entries(reasonCounts).forEach(([reason, count]) => {
            message += `- ${reason}: ${count}\n`;
          });
        }

        // Show errors
        if (errors && errors.length > 0) {
          message += `\nErrors:\n`;
          errors.forEach((err: { assetId: string; error: string }, i: number) => {
            if (i < 3) { // Only show first 3
              message += `- Asset ${err.assetId}: ${err.error}\n`;
            }
          });
          if (errors.length > 3) {
            message += `... and ${errors.length - 3} more errors\n`;
          }
        }

        message += `\n` + (summary.assetsImported > 0 ? "Refresh to see your imported recordings!" : "No new recordings found.");
        alert(message);
      } else {
        throw new Error(result.error || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to import recordings. Please try again.");
    } finally {
      setSyncing(false);
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
            <button
              onClick={syncRecordings}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-blue-600 text-white rounded-full text-sm md:text-base font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              title="Import all Mux recordings into library"
            >
              <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{syncing ? "Importing..." : "Import from Mux"}</span>
              <span className="sm:hidden">Import</span>
            </button>
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
                      <div className="absolute top-3 right-3 flex gap-2">
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
                      <div className="mt-2 text-[10px] uppercase text-zinc-500">
                        Provider: {video.provider === "mux" ? "Mux" : "Livepeer"}
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

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(video._id, video.title);
                    }}
                    className="w-10 h-10 bg-red-600/90 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm"
                    title="Delete video"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
