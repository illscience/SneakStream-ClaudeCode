"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { Zap, Lock, Play, Sparkles } from "lucide-react";

interface LivestreamPPVGateProps {
  livestreamId: Id<"livestreams">;
  title: string;
  price: number; // in cents
  children: React.ReactNode;
}

export function LivestreamPPVGate({
  livestreamId,
  title,
  price,
  children,
}: LivestreamPPVGateProps) {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    userId ? { userId, livestreamId } : "skip"
  );

  // Admin bypass - admins can view any stream without entitlement
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    userId ? { clerkId: userId } : "skip"
  );

  const handlePurchase = async () => {
    if (!isSignedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ppv/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livestreamId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create purchase session");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="relative min-h-[420px] sm:min-h-0 sm:aspect-video bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // User has access - show content (entitlement OR admin)
  if (isSignedIn && (hasEntitlement || isAdmin)) {
    return <>{children}</>;
  }

  const priceDisplay = `$${(price / 100).toFixed(2)}`;

  // Paywall UI
  return (
    <>
      {/* Float animation keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    <div className="relative min-h-[420px] sm:min-h-0 sm:aspect-video bg-zinc-950 rounded-2xl overflow-hidden">
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-2xl p-[2px] overflow-hidden">
        <div
          className="absolute inset-[-100%] animate-[spin_4s_linear_infinite]"
          style={{
            background: "conic-gradient(from 0deg, #c4ff0e, #ff00ff, #c4ff0e, #ff00ff, #c4ff0e)",
          }}
        />
      </div>

      {/* Inner content container */}
      <div className="absolute inset-[2px] bg-zinc-950 rounded-2xl overflow-hidden">
        {/* Ambient glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-lime-400/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 text-center">
          {/* LIVE Badge */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-lg blur-md animate-pulse" />
              <div className="relative flex items-center gap-1.5 bg-red-600 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
                <span className="text-[10px] sm:text-xs font-black tracking-wider text-white">LIVE</span>
              </div>
            </div>
          </div>

          {/* Sneak House Party Logo */}
          <div className="relative mb-2 sm:mb-4">
            {/* Multi-layer glow effect matching logo colors */}
            <div
              className="absolute inset-0 blur-2xl sm:blur-3xl opacity-60 animate-pulse"
              style={{
                background: "radial-gradient(ellipse at center, rgba(255, 100, 50, 0.4) 0%, rgba(180, 50, 200, 0.3) 50%, transparent 70%)",
              }}
            />
            <div
              className="absolute inset-0 blur-xl opacity-40 animate-pulse"
              style={{
                animationDelay: "0.5s",
                background: "radial-gradient(ellipse at center, rgba(255, 150, 50, 0.5) 0%, transparent 60%)",
              }}
            />
            {/* Logo with subtle float animation */}
            <img
              src="/sneak-logo.png"
              alt="Sneak House Party"
              className="relative w-32 h-auto sm:w-44 md:w-52 lg:w-60 drop-shadow-2xl"
              style={{
                animation: "float 3s ease-in-out infinite",
                filter: "drop-shadow(0 0 20px rgba(255, 100, 50, 0.3))",
              }}
            />
          </div>

          {/* Small lock indicator */}
          <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500" />
            <span className="text-xs sm:text-sm text-zinc-500 uppercase tracking-wider font-medium">Exclusive Access</span>
          </div>

          {/* Price display */}
          <div className="relative mb-2 sm:mb-3">
            <span
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight"
              style={{
                background: "linear-gradient(135deg, #c4ff0e 0%, #fff 50%, #ff00ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {priceDisplay}
            </span>
          </div>

          {/* Value proposition */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-xs sm:text-sm mb-4 sm:mb-5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-400" />
            <span>Access this live stream + recording</span>
          </div>

          {/* Action area */}
          <div className="w-full max-w-sm">
            {isSignedIn ? (
              <>
                <button
                  onClick={handlePurchase}
                  disabled={isLoading}
                  className="group relative w-full overflow-hidden rounded-xl font-bold text-base sm:text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Button gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-lime-400 via-lime-300 to-lime-400 transition-all duration-300 group-hover:from-lime-300 group-hover:via-white group-hover:to-lime-300" />

                  {/* Shimmer effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </div>

                  {/* Button content */}
                  <div className="relative flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-4 text-black">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Unlock Stream</span>
                      </>
                    )}
                  </div>
                </button>

                {error && (
                  <p className="mt-3 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-zinc-500 text-sm">Sign in to unlock this stream</p>
                <SignInButton mode="modal">
                  <button className="group relative w-full overflow-hidden rounded-xl font-bold text-base sm:text-lg">
                    {/* Button border gradient */}
                    <div className="absolute inset-0 rounded-xl p-[2px]">
                      <div className="absolute inset-0 bg-gradient-to-r from-lime-400 to-fuchsia-500 rounded-xl" />
                    </div>

                    {/* Button inner */}
                    <div className="relative flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-4 bg-zinc-950 rounded-[10px] m-[2px] text-white transition-colors group-hover:bg-zinc-900">
                      <Play className="w-5 h-5" />
                      <span>Sign In to Purchase</span>
                    </div>
                  </button>
                </SignInButton>
              </div>
            )}
          </div>

          {/* Footer text */}
          <p className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-zinc-600">
            One-time purchase. Watch live and replay anytime.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
