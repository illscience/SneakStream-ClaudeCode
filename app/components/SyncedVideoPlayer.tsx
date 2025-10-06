"use client";

import Hls from "hls.js";
import { Maximize2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface SyncedVideoPlayerProps {
  videoId: Id<"videos">;
  videoTitle: string;
  playbackUrl: string;
  className?: string;
  isMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}

export default function SyncedVideoPlayer({
  videoId,
  videoTitle,
  playbackUrl,
  className = "",
  isMuted = true,
  onMutedChange,
}: SyncedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get the video with startTime (t0)
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  // Attach playback URL via hls.js when needed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
    } else {
      video.src = playbackUrl;
    }

    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;

    const handlePlayAttempt = () => {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Allow user gesture to start playback later
        });
      }
    };

    handlePlayAttempt();

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.pause();
    };
  }, [playbackUrl]);

  // Calculate current playback position based on t0
  useEffect(() => {
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
  }, [defaultVideo, videoId, hasInitialized]);

  useEffect(() => {
    setHasInitialized(false);
  }, [playbackUrl, videoId]);

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

  // Prevent user from pausing or seeking
  useEffect(() => {
    if (!videoRef.current) return;

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
  }, [defaultVideo]);

  // Track fullscreen state for icon updates
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <div className="absolute top-4 left-4 z-10">
        <div className="px-3 py-1 bg-zinc-800 rounded-full text-xs">
          {videoTitle}
        </div>
      </div>
    </div>
  );
}
