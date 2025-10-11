"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Radio, Video, Eye, CheckCircle, Volume2 } from "lucide-react";
import MainNav from "@/components/navigation/MainNav";
import Hls from "hls.js";

type StreamStep = "idle" | "preview" | "live";

export default function MuxGoLivePage() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("classic");
  const [streamStep, setStreamStep] = useState<StreamStep>("idle");
  const [previewStream, setPreviewStream] = useState<{
    streamId: string;
    streamKey: string;
    playbackId: string;
    playbackUrl: string;
    rtmpIngestUrl: string;
  } | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"waiting" | "connected" | "error">("waiting");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const activeStream = useQuery(api.livestream.getActiveStream);
  const startStream = useMutation(api.livestream.startStream);
  const endStream = useMutation(api.livestream.endStream);
  const updateStreamTitle = useMutation(api.livestream.updateStreamTitle);
  const savedCredentials = useQuery(
    api.streamCredentials.getOrCreateCredentials,
    user?.id ? { userId: user.id } : "skip"
  );
  const saveCredentials = useMutation(api.streamCredentials.saveCredentials);

  // Setup HLS player for preview and live stream
  useEffect(() => {
    const video = videoRef.current;
    const playbackUrl = activeStream?.playbackUrl || previewStream?.playbackUrl;
    if (!video || !playbackUrl) return;

    console.log("Setting up player with URL:", playbackUrl);

    // Clean up existing HLS instance before creating new one
    if (hlsRef.current) {
      console.log("Destroying existing HLS player");
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const setupPlayer = async () => {
      // Start muted to comply with autoplay policies
      video.muted = true;

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        console.log("Using native HLS support");
        video.src = playbackUrl;
        setStreamStatus("connected");
        video.play().catch(err => console.log("Autoplay blocked:", err.message));
      } else {
        // Use HLS.js for other browsers
        console.log("Using HLS.js");
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          hlsRef.current = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            debug: false, // Reduced logging
          });

          hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed, starting playback");
            setStreamStatus("connected");
            video.play().catch(err => console.log("Autoplay blocked:", err.message));
          });

          hlsRef.current.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string }) => {
            console.error("HLS error:", data);
            if (data.fatal) {
              if (data.type === "networkError") {
                console.log("Network error, will retry...");
                setStreamStatus("waiting");
                // Retry loading after a delay
                setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.loadSource(playbackUrl);
                  }
                }, 3000);
              } else {
                setStreamStatus("error");
              }
            }
          });

          hlsRef.current.loadSource(playbackUrl);
          hlsRef.current.attachMedia(video);
        } else {
          console.error("HLS not supported in this browser");
        }
      }
    };

    setupPlayer();

    return () => {
      if (hlsRef.current) {
        console.log("Cleaning up HLS player");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeStream?.playbackUrl, previewStream?.playbackUrl]);

  // Detect audio in preview video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || streamStatus !== "connected") return;

    const checkAudio = () => {
      // Check if video element has audio tracks
      const hasAudioTrack = (video as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } }).mozHasAudio ||
                           Boolean((video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount) ||
                           Boolean((video as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks?.length);

      if (hasAudioTrack) {
        console.log("Audio detected in stream");
        setHasAudio(true);
      }
    };

    // Check periodically for audio
    const audioCheckInterval = setInterval(checkAudio, 1000);

    video.addEventListener("loadedmetadata", checkAudio);
    video.addEventListener("playing", checkAudio);

    return () => {
      clearInterval(audioCheckInterval);
      video.removeEventListener("loadedmetadata", checkAudio);
      video.removeEventListener("playing", checkAudio);
    };
  }, [streamStatus]);

  const handleStartPreview = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let streamData;

      // Check if user has saved credentials
      if (savedCredentials) {
        // Reuse existing stream
        streamData = {
          streamId: savedCredentials.streamId,
          streamKey: savedCredentials.streamKey,
          playbackId: savedCredentials.playbackId,
          playbackUrl: savedCredentials.playbackUrl,
          rtmpIngestUrl: savedCredentials.rtmpIngestUrl,
        };
        console.log("Reusing existing stream credentials");
      } else {
        // Create new stream
        const response = await fetch("/api/stream/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "DJ SNEAK Live", provider: "mux" }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create Mux live stream");
        }

        streamData = await response.json();

        // Save credentials for reuse
        await saveCredentials({
          userId: user.id,
          provider: "mux",
          streamId: streamData.streamId,
          streamKey: streamData.streamKey,
          playbackId: streamData.playbackId,
          playbackUrl: streamData.playbackUrl,
          rtmpIngestUrl: streamData.rtmpIngestUrl,
        });
        console.log("Created and saved new stream credentials");
      }

      setPreviewStream(streamData);
      setStreamStep("preview");
    } catch (error) {
      console.error("Failed to start preview", error);
      alert(error instanceof Error ? error.message : "Failed to start preview");
    }
    setIsLoading(false);
  };

  const handleConfirmGoLive = async () => {
    if (!user || !previewStream) return;
    setIsLoading(true);
    try {
      await startStream({
        userId: user.id,
        userName: user.fullName || user.username || "DJ SNEAK",
        title: "DJ SNEAK Live",
        description: "Live DJ set",
        provider: "mux",
        streamId: previewStream.streamId,
        streamKey: previewStream.streamKey,
        playbackId: previewStream.playbackId,
        playbackUrl: previewStream.playbackUrl,
        rtmpIngestUrl: previewStream.rtmpIngestUrl,
      });
      setStreamStep("live");
      // Keep previewStream so video continues playing
    } catch (error) {
      console.error("Failed to go live", error);
      alert(error instanceof Error ? error.message : "Failed to go live");
    }
    setIsLoading(false);
  };

  const handleCancelPreview = () => {
    setStreamStep("idle");
    setPreviewStream(null);
    setHasAudio(false);
    setStreamStatus("waiting");
  };

  const handleEndStream = async () => {
    if (!activeStream) return;
    setIsLoading(true);
    try {
      // Fetch the asset info from Mux
      const response = await fetch("/api/stream/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: activeStream.streamId }),
      });

      const assetData = await response.json();

      // End stream and save recording
      await endStream({
        streamId: activeStream._id,
        assetId: assetData.assetId,
        playbackId: assetData.playbackId,
        duration: assetData.duration,
      });
    } catch (error) {
      console.error("Failed to end stream:", error);
    }
    setIsLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Sign In Required</h1>
          <p className="text-zinc-400">You need to sign in to go live</p>
        </div>
      </div>
    );
  }

  const ingestUrl = activeStream?.rtmpIngestUrl || "rtmp://global-live.mux.com:5222/app";

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />

      <main className="pt-24 px-4 lg:px-8 pb-16 max-w-2xl mx-auto">
        {activeStream && (
          <div className="mb-8 p-6 bg-red-600/20 border border-red-600 rounded-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <h3 className="font-bold">You&apos;re Live!</h3>
                  <p className="text-sm text-zinc-300">Broadcasting on the main feed</p>
                </div>
              </div>
              <button
                onClick={handleEndStream}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-semibold transition-colors disabled:opacity-50"
              >
                End Stream
              </button>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {!activeStream && streamStep === "idle" && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-lime-400 rounded-full flex items-center justify-center">
                  <Radio className="w-10 h-10 text-black" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">Go Live</h1>
                <p className="text-zinc-400">Preview your stream before going live</p>
              </div>
              <button
                onClick={handleStartPreview}
                disabled={isLoading}
                className="w-full py-6 bg-lime-400 text-black font-bold text-xl rounded-full hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Eye className="w-6 h-6" />
                {isLoading ? "Setting Up..." : "Start Preview"}
              </button>
            </div>
          )}

          {!activeStream && streamStep === "preview" && previewStream && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Stream Preview</h2>
                <p className="text-zinc-400 text-sm">Connect your encoder and verify video & audio</p>
                {previewStream.playbackId && (
                  <p className="text-xs text-zinc-600 mt-1">Playback ID: {previewStream.playbackId}</p>
                )}
              </div>

              {/* Video Preview */}
              <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-700">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  controls
                  className="w-full h-full"
                />
                {streamStatus === "waiting" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-white font-medium">Waiting for stream...</p>
                      <p className="text-zinc-400 text-sm mt-1">Start streaming from OBS</p>
                    </div>
                  </div>
                )}
                {streamStatus === "connected" && hasAudio && (
                  <div className="absolute top-4 right-4 bg-lime-400 text-black px-3 py-1 rounded-full flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Audio Detected
                  </div>
                )}
                {streamStatus === "connected" && !hasAudio && (
                  <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full flex items-center gap-2 text-sm font-semibold">
                    <Volume2 className="w-4 h-4" />
                    No Audio
                  </div>
                )}
              </div>

              {/* Stream Details */}
              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                <h3 className="font-bold mb-3 text-sm text-zinc-400">ENCODER SETTINGS</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-zinc-500 mb-1">RTMP URL:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {previewStream.rtmpIngestUrl}
                    </code>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1">Stream Key:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {previewStream.streamKey}
                    </code>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelPreview}
                  disabled={isLoading}
                  className="flex-1 py-4 bg-zinc-800 text-white font-semibold rounded-full hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGoLive}
                  disabled={isLoading}
                  className="flex-1 py-4 bg-lime-400 text-black font-bold rounded-full hover:bg-lime-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  {isLoading ? "Going Live..." : "Confirm & Go Live"}
                </button>
              </div>

              <p className="text-center text-xs text-zinc-500">
                Make sure you can see video and hear audio before going live
              </p>
            </div>
          )}

          {activeStream && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">You&apos;re Live!</h2>
                <p className="text-zinc-400 text-sm">Broadcasting to the main feed</p>
              </div>

              {/* Live Video Preview */}
              <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-lime-400/30">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  controls
                  className="w-full h-full"
                />
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-semibold">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>

              {/* Editable Title */}
              <div>
                <label className="text-zinc-400 text-sm mb-2 block font-medium">Stream Title</label>
                <input
                  type="text"
                  value={activeStream.title}
                  onChange={async (e) => {
                    const newTitle = e.target.value;
                    await updateStreamTitle({
                      streamId: activeStream._id,
                      title: newTitle,
                    });
                  }}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-lime-400 transition-colors"
                  placeholder="Enter stream title..."
                />
              </div>

              {/* Stream Details */}
              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                <h3 className="font-bold mb-3 text-sm text-zinc-400">ENCODER SETTINGS</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-zinc-500 mb-1">RTMP URL:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {activeStream.rtmpIngestUrl || ingestUrl}
                    </code>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1">Stream Key:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {activeStream.streamKey || "—"}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
