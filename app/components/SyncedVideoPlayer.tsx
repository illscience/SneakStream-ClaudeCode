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
  const [isSyncing, setIsSyncing] = useState(false);

  // Get synchronized playback state
  const playbackState = useQuery(api.playbackState.getPlaybackState);
  const updatePlaybackState = useMutation(api.playbackState.updatePlaybackState);

  // Sync video position with server state
  useEffect(() => {
    if (!playbackState || !videoRef.current || playbackState.videoId !== videoId) {
      return;
    }

    const video = videoRef.current;
    const timeDiff = Math.abs(video.currentTime - playbackState.currentTime);

    // If we're more than 3 seconds out of sync, jump to correct position
    if (timeDiff > 3 && !isSyncing) {
      setIsSyncing(true);
      video.currentTime = playbackState.currentTime;

      // Match play/pause state
      if (playbackState.isPlaying && video.paused) {
        video.play().catch(console.error);
      } else if (!playbackState.isPlaying && !video.paused) {
        video.pause();
      }

      setTimeout(() => setIsSyncing(false), 1000);
    }
  }, [playbackState, videoId, isSyncing]);

  // Update server state periodically (only from one client - can be controlled)
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !isSyncing) {
        updatePlaybackState({
          videoId,
          currentTime: videoRef.current.currentTime,
          isPlaying: !videoRef.current.paused,
        }).catch(console.error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [videoId, isSyncing, updatePlaybackState]);

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
      {isSyncing && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 px-4 py-2 rounded-lg text-sm">
          Syncing...
        </div>
      )}
    </div>
  );
}
