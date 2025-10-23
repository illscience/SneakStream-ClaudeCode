'use client';

import { Heart, Download, Share2, Volume2, VolumeX, Tv, LayoutGrid, UserPlus, UserCheck, Clock, Radio } from "lucide-react";
import SyncedVideoPlayer from "./components/SyncedVideoPlayer";
import VideoTimer from "./components/VideoTimer";
import MainNav from "@/components/navigation/MainNav";
import NightclubSimulation from "./components/NightclubSimulation";
import LiveChat from "./components/LiveChat";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const { user } = useUser();
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("theater");
  const [isMuted, setIsMuted] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(0);

  // Load layout mode from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem('layoutMode');
    if (saved === 'classic' || saved === 'theater') {
      setLayoutMode(saved);
    }
  }, []);

  // Save layout mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('layoutMode', layoutMode);
  }, [layoutMode]);

  // Force classic layout on screens below the lg breakpoint
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024);
      if (width < 1024 && layoutMode !== 'classic') {
        setLayoutMode('classic');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [layoutMode]);

  // Get active live stream
  const activeStream = useQuery(api.livestream.getActiveStream);

  // Get default video to play when no live stream is active
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  // Get playlist (next videos queued to play)
  const playlist = useQuery(api.playlist.getPlaylist);

  // Get admin setting for showing nightclub on homepage
  const showNightclubOnHome = useQuery(
    api.adminSettings.getSetting,
    { key: "showNightclubOnHome" }
  );

  // Get the streamer's userId (from active stream or default video)
  const streamerId = activeStream?.userId || defaultVideo?.userId;

  // Get streamer user info
  const streamerUser = useQuery(
    api.users.getUserByClerkId,
    streamerId ? { clerkId: streamerId } : "skip"
  );

  // Follow/unfollow mutations and queries
  const followUser = useMutation(api.follows.followUser);
  const unfollowUser = useMutation(api.follows.unfollowUser);
  const isFollowing = useQuery(
    api.follows.isFollowing,
    user?.id && streamerId ? { followerId: user.id, followingId: streamerId } : "skip"
  );
  const followerCount = useQuery(
    api.users.getFollowerCount,
    streamerId ? { clerkId: streamerId } : "skip"
  );

  // Check if viewing own content
  const isOwnContent = user?.id === streamerId;

  // Mutations
  const updateViewerCount = useMutation(api.livestream.updateViewerCount);
  const incrementHeartCount = useMutation(api.videos.incrementHeartCount);

  // Get heart count from current video
  const heartCount = defaultVideo?.heartCount || 0;

  // Poll viewer count for active streams
  useEffect(() => {
    if (!activeStream?.playbackId) return;

    const fetchViewers = async () => {
      try {
        const response = await fetch(`/api/viewers?playbackId=${activeStream.playbackId}`);
        const data = await response.json();
        if (data.viewers !== undefined) {
          setViewerCount(data.viewers);
          // Update Convex so all clients see the same count
          await updateViewerCount({
            streamId: activeStream._id,
            viewerCount: data.viewers,
          });
        }
      } catch (error) {
        console.error("Failed to fetch viewer count:", error);
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [activeStream?.playbackId, activeStream?._id, updateViewerCount]);

  const heroTitle = activeStream?.title ?? defaultVideo?.title ?? "Dream In Audio";

  const renderVideoContent = () => {
    if (activeStream && activeStream.playbackUrl) {
      return (
        <SyncedVideoPlayer
          videoId={activeStream._id}
          videoTitle={activeStream.title}
          playbackUrl={activeStream.playbackUrl}
          className="w-full h-full"
          isMuted={isMuted}
          onMutedChange={setIsMuted}
          isLiveStream={true}
        />
      );
    }

    if (defaultVideo && defaultVideo.playbackUrl) {
      return (
        <SyncedVideoPlayer
          videoId={defaultVideo._id}
          videoTitle={defaultVideo.title}
          playbackUrl={defaultVideo.playbackUrl}
          className="w-full h-full"
          isMuted={isMuted}
          onMutedChange={setIsMuted}
        />
      );
    }

    return (
      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🎵</div>
          <p className="text-zinc-400">No live stream currently</p>
          <p className="text-zinc-600 text-sm mt-1">Check back soon</p>
        </div>
      </div>
    );
  };

  const handleFollowClick = async () => {
    if (!user || !streamerId) {
      // Trigger sign in modal or no streamer
      return;
    }

    if (isFollowing) {
      await unfollowUser({
        followerId: user.id,
        followingId: streamerId,
      });
    } else {
      await followUser({
        followerId: user.id,
        followingId: streamerId,
      });
    }
  };

  const handleHeart = async () => {
    if (!defaultVideo?._id) return;

    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 300);

    await incrementHeartCount({ videoId: defaultVideo._id });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />

      {/* Main Content */}
      <main className="pt-20">
        {/* DJ Hero Section */}
        <section className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl mx-4 lg:mx-8 overflow-hidden border border-zinc-700/50">
          <div className="px-4 pt-4 pb-0 lg:px-8 lg:pt-5">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-white leading-tight sm:text-4xl lg:text-6xl tracking-tight">
                {heroTitle}
              </h1>
            </div>

            {/* Mobile - Video Only */}
            {!isDesktop && (
              <div className="lg:hidden space-y-3">
                <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-zinc-900">
                  {renderVideoContent()}
                </div>

                {/* Mobile Timer - only show for default video */}
                {!activeStream && defaultVideo?.startTime !== undefined && defaultVideo?.duration && (
                  <div className="flex justify-center">
                    <VideoTimer
                      startTime={defaultVideo.startTime}
                      duration={defaultVideo.duration}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side Action Buttons - Mobile */}
          <div className="lg:hidden absolute right-4 bottom-24 flex flex-col gap-3">
            <button
              onClick={handleHeart}
              className={`bg-red-600 rounded-xl flex flex-col items-center justify-center hover:bg-red-700 transition-all px-3 py-2 ${
                isHeartAnimating ? "scale-110" : ""
              }`}
            >
              <Heart className="w-5 h-5 fill-white" />
              <span className="text-xs font-bold mt-1">{heartCount}</span>
            </button>
          </div>
        </section>

        {/* Desktop Video Layout */}
        {isDesktop && (
          <div className="px-8 py-8">
            <div className="flex justify-center">
              <div className="max-w-6xl w-full space-y-4">
                <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                  {renderVideoContent()}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleHeart}
                    className={`flex items-center gap-2 px-4 py-2 bg-red-600 rounded-full font-medium hover:bg-red-700 transition-all ${
                      isHeartAnimating ? "scale-110" : ""
                    }`}
                  >
                    <Heart className="w-4 h-4 fill-white" />
                    <span className="text-sm">{heartCount}</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: 'DJ Sneak Live',
                            text: 'Check out this live DJ stream!',
                            url: window.location.href,
                          });
                        } catch (err) {
                          // User cancelled or share failed
                          console.log('Share cancelled or failed:', err);
                        }
                      } else {
                        // Fallback: copy to clipboard
                        navigator.clipboard.writeText(window.location.href);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full font-medium hover:bg-zinc-700"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm">Share</span>
                  </button>

                  {/* Video Timer - only show for default video */}
                  {!activeStream && defaultVideo?.startTime !== undefined && defaultVideo?.duration && (
                    <VideoTimer
                      startTime={defaultVideo.startTime}
                      duration={defaultVideo.duration}
                    />
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {activeStream ? (
                      <span className="px-3 py-1 bg-red-600 rounded-full text-xs flex items-center gap-1">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-zinc-700 rounded-full text-xs">
                        REPLAY
                      </span>
                    )}
                    {activeStream && (
                      <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs">
                        {viewerCount.toLocaleString()} {viewerCount === 1 ? 'Viewer' : 'Viewers'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Now Playing / Up Next Section */}
        {!activeStream && (defaultVideo || (playlist && playlist.length > 0)) && (
          <div className="px-4 lg:px-8 py-8">
            <div className="flex justify-center">
              <div className="max-w-6xl w-full">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  {/* Current Playing */}
                  {defaultVideo && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Radio className="w-4 h-4 text-lime-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-400">Now Playing</h3>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Link href={`/watch/${defaultVideo._id}`} className="hover:text-lime-400 transition-colors">
                            <h4 className="font-bold text-lg">{defaultVideo.title}</h4>
                          </Link>
                          {defaultVideo.description && (
                            <p className="text-sm text-zinc-400 mt-1 line-clamp-1">{defaultVideo.description}</p>
                          )}
                        </div>
                        {defaultVideo.duration && (
                          <div className="flex items-center gap-1 text-zinc-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">
                              {Math.floor(defaultVideo.duration / 60)}:{String(Math.floor(defaultVideo.duration % 60)).padStart(2, "0")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Up Next Queue */}
                  {playlist && playlist.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Up Next</h3>
                      <div className="space-y-2">
                        {playlist.slice(0, 5).map((entry, index) => (
                          <div key={entry._id} className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                            <div className="flex items-center justify-center w-8 h-8 bg-zinc-700 rounded-full text-sm font-bold text-zinc-400">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link href={`/watch/${entry.videoId}`} className="hover:text-lime-400 transition-colors">
                                <h4 className="font-medium truncate">{entry.video?.title || "Untitled"}</h4>
                              </Link>
                              {entry.video?.description && (
                                <p className="text-xs text-zinc-500 truncate">{entry.video.description}</p>
                              )}
                            </div>
                            {entry.video?.duration && (
                              <div className="flex items-center gap-1 text-zinc-500">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs">
                                  {Math.floor(entry.video.duration / 60)}:{String(Math.floor(entry.video.duration % 60)).padStart(2, "0")}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {playlist.length > 5 && (
                        <p className="text-xs text-zinc-500 mt-3 text-center">
                          +{playlist.length - 5} more in queue
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nightclub and Chat Section */}
        <div className="px-4 lg:px-8 pb-48 pt-8">
          {showNightclubOnHome ? (
            // Full layout when nightclub is visible
            <NightclubSimulation>
              <LiveChat />
            </NightclubSimulation>
          ) : (
            // Align chat with video content when nightclub is hidden
            <div className="flex justify-center">
              <div className="max-w-6xl w-full">
                <LiveChat />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Audio Player Controls */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-gradient-to-b from-zinc-900 to-black">
        {/* Controls */}
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-3 lg:px-8 lg:py-4">
          {/* Left - Playback Controls */}
          <div className="flex items-center gap-3 sm:gap-4 lg:flex-1">
            <button
              onClick={() => {
                setIsMuted(!isMuted);
              }}
              className={`flex h-10 items-center justify-center gap-2 rounded-full px-4 transition-colors ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-5 h-5" />
                  <span className="text-sm font-medium">MUTED</span>
                </>
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {streamerUser && (
              <div className="flex items-center gap-0 bg-zinc-800/70 rounded-full border border-zinc-700/50 overflow-hidden">
                <div className="px-4 py-2">
                  <span className="text-sm font-semibold text-white">{streamerUser.alias}</span>
                </div>

                {!isOwnContent && (
                  <>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <button className="flex h-10 w-10 items-center justify-center border-l border-zinc-700/50 text-white transition-colors hover:bg-white/10">
                          <UserPlus className="w-5 h-5" />
                        </button>
                      </SignInButton>
                    </SignedOut>

                    <SignedIn>
                      <button
                        onClick={handleFollowClick}
                        className={`flex h-10 w-10 items-center justify-center border-l border-zinc-700/50 transition-colors ${
                          isFollowing
                            ? 'bg-lime-400 text-black hover:bg-lime-500'
                            : 'text-white hover:bg-zinc-700'
                        }`}
                      >
                        {isFollowing ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                      </button>
                    </SignedIn>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right - View Controls */}
          <div className="hidden lg:flex items-center gap-3 flex-1 justify-end">
            <button
              onClick={() => setLayoutMode(layoutMode === "classic" ? "theater" : "classic")}
              className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setLayoutMode("theater")}
              className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <Tv className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
