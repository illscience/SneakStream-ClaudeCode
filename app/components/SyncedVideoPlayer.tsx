"use client";

import Hls from "hls.js";
import { Maximize2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface SyncedVideoPlayerProps {
  videoId: Id<"videos"> | Id<"livestreams">;
  videoTitle: string;
  playbackUrl: string;
  className?: string;
  isMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  isLiveStream?: boolean;
  enableSync?: boolean; // When false, plays independently without syncing to global timeline
}

export default function SyncedVideoPlayer({
  videoId,
  videoTitle,
  playbackUrl,
  className = "",
  isMuted = true,
  onMutedChange,
  isLiveStream = false,
  enableSync = true,
}: SyncedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get the video with startTime (t0) - only for synced, non-live streams
  const defaultVideo = useQuery(
    api.videos.getDefaultVideo,
    (isLiveStream || !enableSync) ? "skip" : undefined
  );

  // Get next video in playlist (for auto-advance)
  const nextInPlaylist = useQuery(
    api.playlist.getNextInPlaylist,
    (isLiveStream || !enableSync) ? "skip" : undefined
  );

  // Mutation to advance playlist
  const advancePlaylist = useMutation(api.playlist.advancePlaylist);

  // Attach playback URL via hls.js when needed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLiveStream,
      });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
    } else {
      video.src = playbackUrl;
    }

    // Set loop based on whether there's a next video
    // Loop if: not live stream AND no next video in queue
    video.loop = !isLiveStream && !nextInPlaylist;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isMuted; // Set initial muted state

    // Enable background audio playback on iOS
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x-webkit-airplay', 'allow');

    const handlePlayAttempt = () => {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch((error) => {
          console.log("Autoplay blocked, waiting for user interaction:", error.message);
          // Allow user gesture to start playback later
        });
      }
    };

    // Handle video end - advance playlist if next video exists
    const handleVideoEnd = async () => {
      if (isLiveStream || !enableSync) return;
      
      console.log("Video ended. Next in playlist:", nextInPlaylist ? "Yes" : "No");
      
      // Check if there's a next video in playlist
      if (nextInPlaylist) {
        console.log("Advancing to next video in playlist...");
        try {
          await advancePlaylist();
        } catch (error) {
          console.error("Failed to advance playlist:", error);
        }
      } else {
        console.log("No next video, looping current video");
      }
    };

    video.addEventListener("ended", handleVideoEnd);

    handlePlayAttempt();

    return () => {
      video.removeEventListener("ended", handleVideoEnd);
      if (hls) {
        hls.destroy();
      }
      video.pause();
    };
  }, [playbackUrl, isLiveStream, enableSync, nextInPlaylist, advancePlaylist]);

  // Calculate current playback position based on t0 (skip for live streams and independent playback)
  useEffect(() => {
    if (isLiveStream || !enableSync) return; // No syncing needed for live streams or independent playback

    const video = videoRef.current;
    if (!defaultVideo || defaultVideo.startTime === undefined || !video || hasInitialized || defaultVideo._id !== videoId) {
      return;
    }

    const startTime = defaultVideo.startTime;
    const duration = defaultVideo.duration || 0;

    const syncToStart = () => {
      const now = Date.now();
      const elapsedTime = (now - startTime) / 1000;
      const startPosition = duration > 0 ? elapsedTime % duration : elapsedTime;
      video.currentTime = startPosition;
      setHasInitialized(true);
    };

    if (video.readyState >= 1) {
      syncToStart();
    } else {
      video.addEventListener("loadedmetadata", syncToStart, { once: true });
    }
  }, [defaultVideo, videoId, hasInitialized, isLiveStream, enableSync]);

  useEffect(() => {
    setHasInitialized(false);
  }, [playbackUrl, videoId, enableSync, isLiveStream]);

  // Set initial volume and muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 1.0;
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync muted state changes back to parent
  useEffect(() => {
    if (!videoRef.current || !onMutedChange) return;

    const video = videoRef.current;
    const handleVolumeChange = () => {
      onMutedChange(video.muted);
    };

    video.addEventListener('volumechange', handleVolumeChange);
    return () => video.removeEventListener('volumechange', handleVolumeChange);
  }, [onMutedChange]);

  // Prevent user from pausing or seeking (only for synced playback)
  useEffect(() => {
    if (!videoRef.current || !enableSync) return;

    const video = videoRef.current;

    const handleSeeking = () => {
      // Prevent seeking by resetting to calculated position
      if (!defaultVideo || defaultVideo.startTime === undefined) return;

      const startTime = defaultVideo.startTime;
      const duration = defaultVideo.duration || 0;

      const now = Date.now();
      const elapsedTime = (now - startTime) / 1000;
      const correctPosition = duration > 0 ? elapsedTime % duration : elapsedTime;

      if (Math.abs(video.currentTime - correctPosition) > 1) {
        video.currentTime = correctPosition;
      }
    };

    video.addEventListener('seeking', handleSeeking);

    return () => {
      video.removeEventListener('seeking', handleSeeking);
    };
  }, [defaultVideo, enableSync]);

  // Track fullscreen state for icon updates
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Resume playback when page becomes visible (e.g., after unlocking phone)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && video.paused) {
        // Re-sync position when coming back from background (only for synced playback)
        if (enableSync && defaultVideo && defaultVideo.startTime !== undefined) {
          const startTime = defaultVideo.startTime;
          const duration = defaultVideo.duration || 0;
          const now = Date.now();
          const elapsedTime = (now - startTime) / 1000;
          const correctPosition = duration > 0 ? elapsedTime % duration : elapsedTime;
          video.currentTime = correctPosition;
        }

        // Attempt to resume playback
        const playPromise = video.play();
        if (playPromise) {
          playPromise.catch((error) => {
            console.log("Auto-play on visibility change blocked:", error);
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [defaultVideo, enableSync]);

  // Set up Media Session API for background audio control
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: videoTitle,
      artist: "Dream In Audio",
      album: "Live Stream",
    });

    // Disable default play/pause actions since we handle them ourselves
    navigator.mediaSession.setActionHandler("play", () => {
      videoRef.current?.play();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      videoRef.current?.pause();
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [videoTitle]);

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      video.requestFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        className="h-full w-full rounded-2xl bg-black object-cover"
        muted={isMuted}
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
