"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface VideoTimerProps {
  startTime: number;
  duration: number;
}

// Multi-color gradients using logo colors
const shimmerGradients = [
  "from-yellow-400 via-orange-400 to-red-400",
  "from-pink-400 via-purple-400 to-blue-400",
  "from-cyan-400 via-blue-400 to-purple-400",
  "from-green-400 via-lime-400 to-yellow-400",
  "from-purple-400 via-pink-400 to-red-400",
  "from-orange-400 via-yellow-400 to-lime-400",
  "from-blue-400 via-cyan-400 to-green-400",
  "from-lime-400 via-green-400 to-cyan-400",
];

export default function VideoTimer({ startTime, duration }: VideoTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isShimmering, setIsShimmering] = useState(false);
  const [currentGradient, setCurrentGradient] = useState(shimmerGradients[0]);
  const [isClockShimmering, setIsClockShimmering] = useState(false);
  const [clockColor, setClockColor] = useState("text-zinc-400");

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

  // Shimmer effect at random intervals
  useEffect(() => {
    const triggerShimmer = () => {
      // Random delay between 8-15 seconds (chill vibes)
      const delay = Math.random() * 7000 + 8000;

      setTimeout(() => {
        // Pick a random gradient
        const randomGradient = shimmerGradients[Math.floor(Math.random() * shimmerGradients.length)];
        setCurrentGradient(randomGradient);
        setIsShimmering(true);

        // End shimmer after 2500ms (slow and smooth)
        setTimeout(() => {
          setIsShimmering(false);
        }, 2500);

        // Schedule next shimmer
        triggerShimmer();
      }, delay);
    };

    triggerShimmer();
  }, []);

  // Independent clock shimmer effect
  useEffect(() => {
    const colors = [
      "text-yellow-400",
      "text-pink-400",
      "text-cyan-400",
      "text-green-400",
      "text-purple-400",
      "text-orange-400",
      "text-red-400",
      "text-blue-400",
      "text-lime-400",
    ];

    const triggerClockShimmer = () => {
      // Random delay between 5-12 seconds (different from main shimmer)
      const delay = Math.random() * 7000 + 5000;

      setTimeout(() => {
        // Pick a random color
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setClockColor(randomColor);
        setIsClockShimmering(true);

        // Fade out after 1800ms
        setTimeout(() => {
          setIsClockShimmering(false);
          setClockColor("text-zinc-400");
        }, 1800);

        // Schedule next shimmer
        triggerClockShimmer();
      }, delay);
    };

    triggerClockShimmer();
  }, []);

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
    <div className={`relative flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full overflow-hidden transition-all duration-700 ${
      isShimmering ? 'shadow-md' : ''
    }`}>
      {/* Animated shimmer overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${currentGradient} transition-opacity duration-1000 ${
          isShimmering ? 'opacity-10' : 'opacity-0'
        }`}
        style={{
          animation: isShimmering ? 'shimmer 2.5s ease-in-out' : 'none',
        }}
      />

      <Clock className={`w-4 h-4 relative z-10 transition-all ${
        isClockShimmering
          ? `${clockColor} scale-110 duration-75`
          : 'text-zinc-400 scale-100 duration-1000'
      }`} />
      <div className="flex flex-col gap-0.5 relative z-10">
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
            className={`h-full transition-all ${
              isShimmering
                ? `bg-gradient-to-r ${currentGradient} duration-1000`
                : 'bg-lime-400 duration-1000 ease-linear'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: -200% center; }
          50% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
