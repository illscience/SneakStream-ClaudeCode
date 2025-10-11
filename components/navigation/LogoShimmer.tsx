"use client";

import { useEffect, useState } from "react";

const circles = [
  { base: "bg-yellow-400", shimmer: "bg-amber-600", alt: "bg-rose-600" },
  { base: "bg-pink-400", shimmer: "bg-fuchsia-600", alt: "bg-violet-600" },
  { base: "bg-cyan-400", shimmer: "bg-sky-600", alt: "bg-teal-600" },
  { base: "bg-green-400", shimmer: "bg-emerald-600", alt: "bg-lime-600" },
  { base: "bg-purple-400", shimmer: "bg-violet-600", alt: "bg-fuchsia-600" },
  { base: "bg-orange-400", shimmer: "bg-amber-600", alt: "bg-yellow-600" },
  { base: "bg-red-400", shimmer: "bg-rose-600", alt: "bg-pink-600" },
  { base: "bg-blue-400", shimmer: "bg-indigo-600", alt: "bg-cyan-600" },
  { base: "bg-lime-400", shimmer: "bg-green-600", alt: "bg-yellow-600" },
];

function Circle({ baseColor, shimmerColor, altColor, turboMode }: { baseColor: string; shimmerColor: string; altColor: string; turboMode: boolean }) {
  const [isShimmering, setIsShimmering] = useState(false);
  const [useAlt, setUseAlt] = useState(false);

  useEffect(() => {
    const triggerShimmer = () => {
      // Turbo mode: 0.5-1.5s, Normal: 2-6 seconds (more frequent)
      const delay = turboMode
        ? Math.random() * 1000 + 500
        : Math.random() * 4000 + 2000;

      setTimeout(() => {
        // Randomly choose between shimmer or alt color for surprise
        setUseAlt(Math.random() > 0.6);
        setIsShimmering(true);

        // Shimmer lasts 1.5 seconds (quick and punchy)
        setTimeout(() => {
          setIsShimmering(false);
        }, 1500);

        // Schedule next shimmer with new random delay
        triggerShimmer();
      }, delay);
    };

    // Start with a random initial delay for each circle
    const initialDelay = turboMode ? Math.random() * 500 : Math.random() * 8000;
    const initialTimeout = setTimeout(triggerShimmer, initialDelay);

    return () => clearTimeout(initialTimeout);
  }, [turboMode]);

  const activeColor = useAlt ? altColor : shimmerColor;

  return (
    <span
      className={`rounded-sm transition-all duration-700 ${
        isShimmering ? `${activeColor} brightness-125 saturate-200 scale-110 shadow-lg` : baseColor
      }`}
    />
  );
}

export default function LogoShimmer() {
  const [turboMode, setTurboMode] = useState(false);
  const [textShimmerColor, setTextShimmerColor] = useState<string | null>(null);

  const handleClick = () => {
    setTurboMode(true);
  };

  // Expose text shimmer color to parent via custom event
  useEffect(() => {
    const triggerTextShimmer = () => {
      // Random delay between 40-80 seconds
      const delay = Math.random() * 40000 + 40000;

      setTimeout(() => {
        // Pick a random vibrant color
        const colors = [
          "text-amber-600",
          "text-fuchsia-600",
          "text-sky-600",
          "text-emerald-600",
          "text-violet-600",
          "text-rose-600",
          "text-indigo-600",
          "text-lime-600",
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setTextShimmerColor(randomColor);

        // Shimmer lasts 2 seconds
        setTimeout(() => {
          setTextShimmerColor(null);
        }, 2000);

        // Schedule next shimmer
        triggerTextShimmer();
      }, delay);
    };

    triggerTextShimmer();
  }, []);

  // Dispatch custom event for text color changes
  useEffect(() => {
    const event = new CustomEvent("logoTextShimmer", { detail: { color: textShimmerColor } });
    window.dispatchEvent(event);
  }, [textShimmerColor]);

  return (
    <span
      className="grid h-9 w-9 grid-cols-3 gap-0.5 cursor-pointer"
      onClick={handleClick}
    >
      {circles.map((circle, index) => (
        <Circle
          key={index}
          baseColor={circle.base}
          shimmerColor={circle.shimmer}
          altColor={circle.alt}
          turboMode={turboMode}
        />
      ))}
    </span>
  );
}
