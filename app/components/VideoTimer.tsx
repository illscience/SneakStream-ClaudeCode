"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface VideoTimerProps {
  startTime: number;
  duration: number;
}

export default function VideoTimer({ startTime, duration }: VideoTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      const elapsedSeconds = elapsedMs / 1000;
      const currentProgress = duration > 0 ? (elapsedSeconds % duration) / duration : 0;

      setElapsed(elapsedSeconds % duration);
      setProgress(currentProgress);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = progress * 100;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full">
      <Clock className="w-4 h-4 text-zinc-400" />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-medium text-white tabular-nums">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-zinc-500">/</span>
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>
        {/* Thin progress bar */}
        <div className="w-full h-0.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
