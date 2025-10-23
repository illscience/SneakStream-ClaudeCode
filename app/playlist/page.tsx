"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MainNav from "@/components/navigation/MainNav";
import { Radio, Trash2, ArrowUp, Play, GripVertical, Clock } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import Link from "next/link";

export default function PlaylistPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("theater");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Get playlist and current default video
  const playlist = useQuery(api.playlist.getPlaylist);
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  // Mutations
  const playNow = useMutation(api.playlist.playNow);
  const removeFromPlaylist = useMutation(api.playlist.removeFromPlaylist);
  const reorderPlaylist = useMutation(api.playlist.reorderPlaylist);

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  // Load layout mode from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem("layoutMode");
    if (saved === "classic" || saved === "theater") {
      setLayoutMode(saved);
    }
  }, []);

  const handlePlayNow = async (videoId: Id<"videos">) => {
    if (!user?.id) return;
    try {
      await playNow({ videoId, clerkId: user.id });
    } catch (error) {
      console.error("Play now error:", error);
      alert("Failed to play video. Please try again.");
    }
  };

  const handleRemove = async (playlistId: Id<"playlist">, videoTitle: string) => {
    if (!confirm(`Remove "${videoTitle}" from queue?`)) {
      return;
    }
    try {
      await removeFromPlaylist({ playlistId });
    } catch (error) {
      console.error("Remove error:", error);
      alert("Failed to remove video. Please try again.");
    }
  };

  const handleMoveToTop = async (playlistId: Id<"playlist">) => {
    try {
      await reorderPlaylist({ playlistId, newPosition: 0 });
    } catch (error) {
      console.error("Reorder error:", error);
      alert("Failed to reorder. Please try again.");
    }
  };

  const handleDragStart = (e: React.DragEvent, playlistId: string) => {
    setDraggedItem(playlistId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetPosition: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    try {
      await reorderPlaylist({
        playlistId: draggedItem as Id<"playlist">,
        newPosition: targetPosition,
      });
    } catch (error) {
      console.error("Reorder error:", error);
      alert("Failed to reorder. Please try again.");
    }
    setDraggedItem(null);
  };

  // Show loading state
  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-xl text-zinc-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />

      <main className="pt-32 px-4 lg:px-8 max-w-6xl mx-auto pb-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Playlist Manager</h1>
          <p className="text-zinc-400">Control what plays for all viewers</p>
        </div>

        {/* Currently Playing */}
        {defaultVideo && (
          <div className="bg-lime-400/10 border border-lime-400/50 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-5 h-5 text-lime-400 animate-pulse" />
              <h2 className="text-lg font-bold text-lime-400">ON AIR NOW</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Link href={`/watch/${defaultVideo._id}`} className="hover:text-lime-400 transition-colors">
                  <h3 className="text-xl font-bold">{defaultVideo.title}</h3>
                </Link>
                {defaultVideo.description && (
                  <p className="text-zinc-400 mt-1">{defaultVideo.description}</p>
                )}
              </div>
              {defaultVideo.duration && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="w-5 h-5" />
                  <span>
                    {Math.floor(defaultVideo.duration / 60)}:{String(Math.floor(defaultVideo.duration % 60)).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Queue */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Up Next ({playlist?.length || 0})</h2>

          {!playlist || playlist.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No videos queued</p>
              <p className="text-sm mt-2">Use "Play Next" or "Play Now" from My Library to add videos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {playlist.map((entry, index) => (
                <div
                  key={entry._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry._id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`flex items-center gap-4 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors group ${
                    draggedItem === entry._id ? "opacity-50" : ""
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="cursor-move text-zinc-600 group-hover:text-zinc-400">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Position */}
                  <div className="flex items-center justify-center w-10 h-10 bg-zinc-700 rounded-full text-lg font-bold">
                    {index + 1}
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/watch/${entry.videoId}`} className="hover:text-lime-400 transition-colors">
                      <h4 className="font-bold truncate">{entry.video?.title || "Untitled"}</h4>
                    </Link>
                    {entry.video?.description && (
                      <p className="text-sm text-zinc-400 truncate">{entry.video.description}</p>
                    )}
                  </div>

                  {/* Duration */}
                  {entry.video?.duration && (
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">
                        {Math.floor(entry.video.duration / 60)}:{String(Math.floor(entry.video.duration % 60)).padStart(2, "0")}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Play Now */}
                    {entry.video && (
                      <button
                        onClick={() => handlePlayNow(entry.videoId)}
                        className="w-9 h-9 bg-lime-400 hover:bg-lime-500 rounded-full flex items-center justify-center text-black"
                        title="Play Now"
                      >
                        <Play className="w-4 h-4 ml-0.5" />
                      </button>
                    )}

                    {/* Move to Top */}
                    {index > 0 && (
                      <button
                        onClick={() => handleMoveToTop(entry._id)}
                        className="w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center"
                        title="Move to Top"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(entry._id, entry.video?.title || "this video")}
                      className="w-9 h-9 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center"
                      title="Remove from Queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Tip:</strong> Drag videos to reorder the queue. When a video ends, the next one plays automatically.
          </p>
        </div>
      </main>
    </div>
  );
}

