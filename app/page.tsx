'use client';

import { Heart, Download, Share2, Volume2, VolumeX, Tv, LayoutGrid, UserPlus, UserCheck } from "lucide-react";
import ChatWindow from "./components/ChatWindow";
import VideoFeed from "./components/VideoFeed";
import SyncedVideoPlayer from "./components/SyncedVideoPlayer";
import MainNav from "@/components/navigation/MainNav";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";

export default function Home() {
  const { user } = useUser();
  const DJ_SNEAK_ID = "dj-sneak"; // Static ID for DJ Sneak
  const [heartCount, setHeartCount] = useState(0);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("theater");
  const [isMuted, setIsMuted] = useState(true);

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
    const enforceClassicOnMobile = () => {
      if (window.innerWidth < 1024 && layoutMode !== 'classic') {
        setLayoutMode('classic');
      }
    };

    enforceClassicOnMobile();
    window.addEventListener('resize', enforceClassicOnMobile);
    return () => window.removeEventListener('resize', enforceClassicOnMobile);
  }, [layoutMode]);

  const followUser = useMutation(api.follows.followUser);
  const unfollowUser = useMutation(api.follows.unfollowUser);
  const isFollowing = useQuery(
    api.follows.isFollowing,
    user?.id ? { followerId: user.id, followingId: DJ_SNEAK_ID } : "skip"
  );
  const followerCount = useQuery(api.users.getFollowerCount, {
    clerkId: DJ_SNEAK_ID,
  });
  // Get active live stream
  const activeStream = useQuery(api.livestream.getActiveStream);

  // Get default video to play when no live stream is active
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  const heroTitle = activeStream?.title ?? defaultVideo?.title ?? "DJ SNEAK";

  const renderVideoContent = () => {
    if (activeStream && activeStream.playbackUrl) {
      return (
        <>
          <video
            controls
            autoPlay
            className="w-full h-full"
            src={activeStream.playbackUrl}
          />
          <div className="absolute top-4 left-4">
            <div className="px-3 py-1 bg-red-600 rounded-full text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE{activeStream.title ? `: ${activeStream.title}` : ""}
            </div>
          </div>
        </>
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
    if (!user) {
      // Trigger sign in modal
      return;
    }

    if (isFollowing) {
      await unfollowUser({
        followerId: user.id,
        followingId: DJ_SNEAK_ID,
      });
    } else {
      await followUser({
        followerId: user.id,
        followingId: DJ_SNEAK_ID,
      });
    }
  };

  const handleHeart = () => {
    setHeartCount(prev => prev + 1);
    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 300);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />

      {/* Main Content */}
      <main className="pt-20">
        {/* DJ Hero Section */}
        <section className="relative bg-gradient-to-br from-pink-200 via-pink-300 to-pink-200 rounded-3xl mx-4 overflow-hidden">
          <div className="px-8 pt-6 pb-0">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="sr-only">{heroTitle}</span>
                <h1 className="hidden sm:block text-4xl font-bold text-black leading-tight lg:text-6xl">
                  {heroTitle}
                </h1>
                {followerCount !== undefined && (
                  <p className="text-sm text-black/60 mt-2">
                    {followerCount} {followerCount === 1 ? "Follower" : "Followers"}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile - Video Only */}
            <div className="lg:hidden relative w-full aspect-video mb-4 overflow-hidden rounded-2xl bg-zinc-900">
              {renderVideoContent()}
            </div>
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
        <div className="hidden lg:block px-8 py-8">
          <div
            className={
              layoutMode === "theater"
                ? "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6"
                : "flex justify-center"
            }
          >
            <div
              className={
                layoutMode === "theater"
                  ? "space-y-4"
                  : "max-w-6xl w-full space-y-4"
              }
            >
              <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                {renderVideoContent()}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleHeart}
                  className={`flex items-center gap-2 px-4 py-2 bg-red-600 rounded-full font-medium hover:bg-red-700 transition-all ${
                    isHeartAnimating ? "scale-110" : ""
                  }`}
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span className="text-sm">{heartCount}</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full font-medium hover:bg-zinc-700">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">Share</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full font-medium hover:bg-zinc-700">
                  <Download className="w-4 h-4" />
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-3 py-1 bg-red-600 rounded-full text-xs flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs">2.4K Viewers</span>
                </div>
              </div>
            </div>

            {layoutMode === "theater" && (
              <div>
                <ChatWindow />
              </div>
            )}
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-4 lg:px-8 pb-48 pt-8">
          {layoutMode === "classic" ? (
            // Classic mode - Chat on the left
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="w-full max-w-md">
                    <ChatWindow />
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <VideoFeed limit={5} />
                </div>
              </div>
            </div>
          ) : (
            // Theater mode - Only show on mobile
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <VideoFeed limit={5} />
              </div>
              <div className="lg:hidden">
                <ChatWindow />
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
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10">
                  <UserPlus className="w-5 h-5" />
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <button
                onClick={handleFollowClick}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isFollowing
                    ? 'bg-lime-400 text-black hover:bg-lime-300'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                {isFollowing ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </button>
            </SignedIn>
          </div>

          {/* Center - Now Playing */}
          <div className="flex-1 rounded-full bg-lime-400 px-5 py-2 text-center text-sm font-semibold text-black shadow-sm sm:px-6 sm:py-3 sm:text-base lg:flex-none">
            {defaultVideo?.title || "No video playing"}
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
