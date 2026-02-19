'use client';

import { useState, useEffect, useCallback } from "react";
import { Scissors, X, Download, Check, Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface ClipShareButtonProps {
  livestreamId?: Id<"livestreams">;
  videoId?: Id<"videos">;
  streamTitle?: string;
}

type ClipState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "processing"; clipAssetId: string }
  | { phase: "ready"; mp4Url: string; playbackId: string }
  | { phase: "error"; message: string };

export default function ClipShareButton({
  livestreamId,
  videoId,
  streamTitle,
}: ClipShareButtonProps) {
  const [state, setState] = useState<ClipState>({ phase: "idle" });
  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const createClip = useCallback(async () => {
    setState({ phase: "creating" });
    setShowPanel(true);

    // Grab current playback position from the video element
    const videoEl = document.querySelector("video");
    const currentTime = videoEl ? videoEl.currentTime : undefined;

    try {
      const payload = livestreamId
        ? { livestreamId }
        : { videoId, currentTime };

      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setState({ phase: "error", message: data.error || "Failed to create clip" });
        return;
      }

      const data = await res.json();
      setState({ phase: "processing", clipAssetId: data.clipAssetId });
    } catch {
      setState({ phase: "error", message: "Network error" });
    }
  }, [livestreamId, videoId]);

  // Poll for clip readiness
  useEffect(() => {
    if (state.phase !== "processing") return;

    const { clipAssetId } = state;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/clips?clipAssetId=${clipAssetId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (cancelled) return;

        if (data.status === "ready" && data.mp4Url) {
          setState({
            phase: "ready",
            mp4Url: data.mp4Url,
            playbackId: data.playbackId,
          });
        } else if (data.status === "failed") {
          setState({ phase: "error", message: "Clip encoding failed" });
        }
      } catch {
        // Retry on next interval
      }
    };

    const interval = setInterval(poll, 3000);
    poll(); // Initial check

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state]);

  const igCaption = streamTitle
    ? `${streamTitle} @sneakhouseparty`
    : "@sneakhouseparty";

  const shareText = streamTitle
    ? `Check out this clip from ${streamTitle}!`
    : "Check out this clip!";

  const [igCopied, setIgCopied] = useState(false);

  const handleShare = async (platform: string) => {
    if (state.phase !== "ready") return;
    const url = state.mp4Url;

    switch (platform) {
      case "instagram": {
        // Try sharing the video file via native share sheet (mobile)
        try {
          const response = await fetch(`${url}?download=clip.mp4`);
          const blob = await response.blob();
          const file = new File([blob], "clip.mp4", { type: "video/mp4" });

          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              text: igCaption,
              files: [file],
            });
            break;
          }
        } catch {
          // Share cancelled or failed — fall through to fallback
        }

        // Fallback: download clip + copy caption
        const link = document.createElement("a");
        link.href = `${url}?download=clip.mp4`;
        link.download = "clip.mp4";
        link.click();
        await navigator.clipboard.writeText(igCaption);
        setIgCopied(true);
        setTimeout(() => setIgCopied(false), 3000);
        break;
      }
      case "copy": {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
      }
      case "native": {
        if (navigator.share) {
          try {
            await navigator.share({ title: shareText, url });
          } catch {
            // User cancelled
          }
        }
        break;
      }
      case "download": {
        const link = document.createElement("a");
        link.href = `${url}?download=clip.mp4`;
        link.download = "clip.mp4";
        link.click();
        break;
      }
    }
  };

  const reset = () => {
    setState({ phase: "idle" });
    setShowPanel(false);
    setCopied(false);
  };

  return (
    <div className="relative">
      {/* Main clip button */}
      <button
        onClick={state.phase === "idle" ? createClip : () => setShowPanel(!showPanel)}
        disabled={state.phase === "creating"}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60"
      >
        {state.phase === "creating" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Scissors className="w-4 h-4" />
        )}
        <span className="text-sm">Clip It</span>
      </button>

      {/* Share panel */}
      {showPanel && state.phase !== "idle" && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">
              {state.phase === "ready" ? "Clip Ready!" : "Creating Clip..."}
            </h3>
            <button onClick={reset} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {(state.phase === "creating" || state.phase === "processing") && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-xs text-zinc-400 text-center">
                {state.phase === "creating"
                  ? "Grabbing the last 15 seconds..."
                  : "Encoding your clip..."}
              </p>
            </div>
          )}

          {state.phase === "ready" && (
            <div className="space-y-2">
              {/* Preview thumbnail */}
              <div className="relative aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-3">
                <img
                  src={`https://image.mux.com/${state.playbackId}/thumbnail.jpg?time=7`}
                  alt="Clip preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  0:15
                </div>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleShare("instagram")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  <span>Instagram</span>
                </button>
                {igCopied && (
                  <p className="col-span-2 text-xs text-green-400 text-center">
                    Clip downloading — caption with @sneakhouseparty copied!
                  </p>
                )}

                <button
                  onClick={() => handleShare("copy")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                  <span>{copied ? "Copied!" : "Copy Link"}</span>
                </button>

                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={() => handleShare("native")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>Share</span>
                  </button>
                )}

                <button
                  onClick={() => handleShare("download")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          )}

          {state.phase === "error" && (
            <div className="py-3">
              <p className="text-sm text-red-400 text-center mb-3">
                {state.message}
              </p>
              <button
                onClick={reset}
                className="w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Arrow pointing down */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-r border-b border-zinc-700 rotate-45" />
        </div>
      )}
    </div>
  );
}
