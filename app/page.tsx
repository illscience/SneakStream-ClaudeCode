'use client';

import { Heart, Download, Share2, MoreHorizontal, Play, Pause, SkipBack, SkipForward, Repeat, Volume2, MessageSquare, Tv, ChevronDown, LayoutGrid, Layout } from "lucide-react";
import ChatWindow from "./components/ChatWindow";
import VideoFeed from "./components/VideoFeed";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Toggle } from "@/components/ui/toggle";

export default function Home() {
  const { user } = useUser();
  const DJ_SNEAK_ID = "dj-sneak"; // Static ID for DJ Sneak
  const [heartCount, setHeartCount] = useState(0);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("theater"); // theater = side-by-side

  const followUser = useMutation(api.follows.followUser);
  const unfollowUser = useMutation(api.follows.unfollowUser);
  const isFollowing = useQuery(
    api.follows.isFollowing,
    user?.id ? { followerId: user.id, followingId: DJ_SNEAK_ID } : "skip"
  );
  const followerCount = useQuery(api.users.getFollowerCount, {
    clerkId: DJ_SNEAK_ID,
  });
  const upsertUser = useMutation(api.users.upsertUser);

  // Get active live stream
  const activeStream = useQuery(api.livestream.getActiveStream);

  // Create/update user in Convex when they sign in
  useEffect(() => {
    if (user) {
      upsertUser({
        clerkId: user.id,
        alias: user.username || user.firstName || "User",
        email: user.primaryEmailAddress?.emailAddress,
        imageUrl: user.imageUrl,
      });
    }
  }, [user]);

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
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 gap-1 w-8 h-8">
            <div className="bg-yellow-400 rounded-sm"></div>
            <div className="bg-pink-400 rounded-sm"></div>
            <div className="bg-cyan-400 rounded-sm"></div>
            <div className="bg-green-400 rounded-sm"></div>
            <div className="bg-purple-400 rounded-sm"></div>
            <div className="bg-orange-400 rounded-sm"></div>
            <div className="bg-red-400 rounded-sm"></div>
            <div className="bg-blue-400 rounded-sm"></div>
            <div className="bg-lime-400 rounded-sm"></div>
          </div>
          <span className="text-xl font-bold">DJ SNEAK</span>
        </div>

        <nav className="flex gap-8 text-sm font-medium">
          <a href="#" className="text-gray-300 hover:text-white">BROWSE</a>
          <a href="/go-live" className="text-gray-300 hover:text-white">GO LIVE</a>
          <a href="/events" className="text-gray-300 hover:text-white">EVENTS</a>
          <SignedIn>
            <a href="/library" className="text-gray-300 hover:text-white">MY LIBRARY</a>
            <a href="/profile" className="text-gray-300 hover:text-white">PROFILE</a>
          </SignedIn>
        </nav>

        <div className="flex items-center gap-3">
          {/* Layout Toggle */}
          <Toggle
            pressed={layoutMode === "theater"}
            onPressedChange={(pressed) => setLayoutMode(pressed ? "theater" : "classic")}
            aria-label="Toggle layout"
            className="hidden lg:flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 data-[state=on]:bg-lime-400 data-[state=on]:text-black rounded-full"
          >
            {layoutMode === "theater" ? (
              <>
                <Layout className="w-4 h-4" />
                <span className="text-xs font-medium">Theater</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-4 h-4" />
                <span className="text-xs font-medium">Classic</span>
              </>
            )}
          </Toggle>

          <button className="px-6 py-2 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300">
            Subscribe
          </button>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10"
                }
              }}
            >
              <UserButton.MenuItems>
                <UserButton.Link
                  label="My Profile"
                  labelIcon={<span>👤</span>}
                  href="/profile"
                />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* DJ Hero Section */}
        <section className="relative bg-gradient-to-br from-pink-200 via-pink-300 to-pink-200 rounded-3xl mx-4 overflow-hidden">
          <div className="px-8 pt-6 pb-0">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-6xl font-bold text-black">DJ SNEAK</h1>
                {followerCount !== undefined && (
                  <p className="text-sm text-black/60 mt-2">
                    {followerCount} {followerCount === 1 ? "Follower" : "Followers"}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center hover:bg-white">
                  <Download className="w-5 h-5 text-black" />
                </button>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-6 py-3 bg-black/90 text-white rounded-full flex items-center gap-2 hover:bg-black">
                      <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-black text-xs">👤</span>
                      </span>
                      <span className="text-sm font-medium">Follow Artist</span>
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <button
                    onClick={handleFollowClick}
                    className={`px-6 py-3 rounded-full flex items-center gap-2 hover:opacity-90 transition-all ${
                      isFollowing
                        ? "bg-white/20 text-white border-2 border-white"
                        : "bg-black/90 text-white"
                    }`}
                  >
                    <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-black text-xs">👤</span>
                    </span>
                    <span className="text-sm font-medium">
                      {isFollowing ? "Following" : "Follow Artist"}
                    </span>
                  </button>
                </SignedIn>
              </div>
            </div>

            {/* Mobile - Video Only */}
            <div className="lg:hidden relative w-full aspect-video mb-4">
              {activeStream && activeStream.playbackUrl ? (
                <video
                  controls
                  autoPlay
                  className="w-full h-full rounded-2xl bg-black"
                  src={activeStream.playbackUrl}
                />
              ) : (
                <video
                  controls
                  autoPlay
                  muted
                  loop
                  className="w-full h-full rounded-2xl bg-black"
                  src="/2025_02_02_09_43_33_V1.mp4"
                />
              )}
              {activeStream && (
                <div className="absolute top-4 left-4">
                  <div className="px-3 py-1 bg-red-600 rounded-full text-xs flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE: {activeStream.title}
                  </div>
                </div>
              )}
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

        {/* Desktop Theater Layout - Video + Chat Side by Side */}
        {layoutMode === "theater" && (
          <div className="hidden lg:block px-8 py-8">
            <div className="grid grid-cols-5 gap-6">
              {/* Video Player - Takes 3 columns */}
              <div className="col-span-3">
                <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                  {activeStream && activeStream.playbackUrl ? (
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
                          LIVE: {activeStream.title}
                        </div>
                      </div>
                    </>
                  ) : (
                    <video
                      controls
                      autoPlay
                      muted
                      loop
                      className="w-full h-full"
                      src="/2025_02_02_09_43_33_V1.mp4"
                    />
                  )}
                </div>

                {/* Video Actions */}
                <div className="flex items-center gap-3 mt-4">
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

              {/* Chat - Takes 2 columns */}
              <div className="col-span-2">
                <ChatWindow />
              </div>
            </div>
          </div>
        )}

        {/* Desktop Classic Layout - Full Width Video */}
        {layoutMode === "classic" && (
          <div className="hidden lg:block px-8 py-8">
            <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl max-w-6xl mx-auto">
              {activeStream && activeStream.playbackUrl ? (
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
                      LIVE: {activeStream.title}
                    </div>
                  </div>
                </>
              ) : (
                <video
                  controls
                  autoPlay
                  muted
                  loop
                  className="w-full h-full"
                  src="/2025_02_02_09_43_33_V1.mp4"
                />
              )}
            </div>

            {/* Video Actions */}
            <div className="flex items-center gap-3 mt-4 max-w-6xl mx-auto">
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
        )}

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
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-zinc-900 to-black border-t border-zinc-800">
        {/* Progress Bar */}
        <div className="h-1 bg-zinc-800">
          <div className="h-full w-1/3 bg-lime-400"></div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-8 py-4">
          {/* Left Controls */}
          <div className="flex items-center gap-4">
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-200">
              <Pause className="w-5 h-5 text-black" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700">
              <Heart className="w-5 h-5 fill-white" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Repeat className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Center - Now Playing */}
          <button className="px-8 py-3 bg-lime-400 text-black rounded-full font-bold hover:bg-lime-300">
            Deep Melodic Vibes Mix
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Heart className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <span className="text-sm">🌐</span>
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Pause className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Pause className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Volume2 className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MessageSquare className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Tv className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MessageSquare className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Tv className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Track Info Bar */}
        <div className="px-8 pb-4">
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <span>🏆</span>
              <span>🎵</span>
            </span>
            <span>HOUSE</span>
            <span>TECHNO</span>
            <span>TRANCE</span>
            <span>D&B</span>
            <span>▶</span>
            <span>⊙</span>
          </div>
        </div>
      </div>
    </div>
  );
}
