"use client";

import * as Player from "@livepeer/react/player";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface SyncedVideoPlayerProps {
  videoId: Id<"videos">;
  videoTitle: string;
  playbackUrl: string;
  className?: string;
}

export default function SyncedVideoPlayer({
  videoId,
  videoTitle,
  playbackUrl,
  className = "",
}: SyncedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Get the initial playback position (only used once on mount)
  const playbackState = useQuery(api.playbackState.getPlaybackState);
  const updatePlaybackState = useMutation(api.playbackState.updatePlaybackState);

  // Set initial position once when component mounts
  useEffect(() => {
    if (!playbackState || !videoRef.current || hasInitialized || playbackState.videoId !== videoId) {
      return;
    }

    const video = videoRef.current;
    const now = Date.now();

    // Calculate where the video should be now based on last saved position
    const timeSinceUpdate = (now - playbackState.updatedAt) / 1000;
    const startPosition = playbackState.isPlaying
      ? playbackState.currentTime + timeSinceUpdate
      : playbackState.currentTime;

    video.currentTime = startPosition;
    setHasInitialized(true);
  }, [playbackState, videoId, hasInitialized]);

  // Periodically update the server with current position (for new clients joining)
  useEffect(() => {
    if (!hasInitialized) return;

    const interval = setInterval(() => {
      if (videoRef.current) {
        updatePlaybackState({
          videoId,
          currentTime: videoRef.current.currentTime,
          isPlaying: !videoRef.current.paused,
        }).catch(console.error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [videoId, hasInitialized, updatePlaybackState]);

  return (
    <div className={`relative ${className}`}>
      <Player.Root
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        src={playbackUrl as any}
        autoPlay
      >
        <Player.Container>
          <Player.Video
            ref={(el) => {
              if (el) {
                videoRef.current = el as HTMLVideoElement;
              }
            }}
            loop
            muted
            className="w-full h-full"
          />
          <Player.Controls className="flex items-center gap-2 px-4 py-2">
            <Player.PlayPauseTrigger />
            <Player.Time />
            <Player.Seek className="flex-1" />
            <Player.MuteTrigger />
            <Player.Volume />
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
