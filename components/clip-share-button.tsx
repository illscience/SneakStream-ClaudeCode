'use client';

import { useState, useEffect, useCallback } from "react";
import { Scissors, X, Download, Check, Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface ClipShareButtonProps {
  livestreamId: Id<"livestreams">;
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
  streamTitle,
}: ClipShareButtonProps) {
  const [state, setState] = useState<ClipState>({ phase: "idle" });
  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const createClip = useCallback(async () => {
    setState({ phase: "creating" });
    setShowPanel(true);

    try {
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livestreamId }),
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
  }, [livestreamId]);

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

  const shareText = streamTitle
    ? `Check out this clip from ${streamTitle}!`
    : "Check out this live stream clip!";

  const handleShare = async (platform: string) => {
    if (state.phase !== "ready") return;
    const url = state.mp4Url;

    switch (platform) {
      case "twitter": {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, "_blank", "noopener");
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
                  onClick={() => handleShare("twitter")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Post</span>
                </button>

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
