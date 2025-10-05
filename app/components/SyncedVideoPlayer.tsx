"use client";

import * as Player from "@livepeer/react/player";
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

  // Get the video with startTime (t0)
  const defaultVideo = useQuery(api.videos.getDefaultVideo);

  // Calculate current playback position based on t0
  useEffect(() => {
    if (!defaultVideo || !defaultVideo.startTime || !videoRef.current || hasInitialized || defaultVideo._id !== videoId) {
      return;
    }

    const video = videoRef.current;
    const now = Date.now();

    // Calculate elapsed time since t0 (in seconds)
    const elapsedTime = (now - defaultVideo.startTime) / 1000;

    // If video has a duration, loop it
    const videoDuration = defaultVideo.duration || 0;
    const startPosition = videoDuration > 0 ? elapsedTime % videoDuration : elapsedTime;

    console.log("Syncing to position:", startPosition, "seconds from t0:", defaultVideo.startTime);
    video.currentTime = startPosition;
    setHasInitialized(true);
  }, [defaultVideo, videoId, hasInitialized]);

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

    const handlePause = () => {
      // Auto-resume if user tries to pause
      video.play().catch(console.error);
    };

    const handleSeeking = () => {
      // Prevent seeking by resetting to calculated position
      if (!defaultVideo || !defaultVideo.startTime) return;

      const now = Date.now();
      const elapsedTime = (now - defaultVideo.startTime) / 1000;
      const videoDuration = defaultVideo.duration || 0;
      const correctPosition = videoDuration > 0 ? elapsedTime % videoDuration : elapsedTime;

      if (Math.abs(video.currentTime - correctPosition) > 1) {
        video.currentTime = correctPosition;
      }
    };

    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);

    return () => {
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
    };
  }, [defaultVideo]);

  return (
    <div className={`relative ${className}`}>
      <Player.Root
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        src={playbackUrl as any}
        autoPlay
        volume={1.0}
      >
        <Player.Container>
          <Player.Video
            ref={(el) => {
              if (el) {
                videoRef.current = el as HTMLVideoElement;
              }
            }}
            loop
            className="w-full h-full"
          />
          <Player.Controls className="flex items-center gap-2 px-4 py-2 justify-end">
            <Player.Time />
            <Player.FullscreenTrigger />
          </Player.Controls>
        </Player.Container>
      </Player.Root>
      <div className="absolute top-4 left-4 z-10">
        <div className="px-3 py-1 bg-zinc-800 rounded-full text-xs">
          {videoTitle}
        </div>
      </div>
    </div>
  );
}
