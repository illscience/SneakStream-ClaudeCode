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
  const [editingTitle, setEditingTitle] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const activeStream = useQuery(api.livestream.getActiveStream);
  const startStream = useMutation(api.livestream.startStream);
  const endStream = useMutation(api.livestream.endStream);
  const createVideo = useMutation(api.videos.createVideo);
  const upsertMuxAsset = useMutation(api.videos.upsertMuxAsset);
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
    console.log("Preview stream:", previewStream);
    console.log("Active stream:", activeStream);

    // Clean up existing HLS instance before creating new one
    if (hlsRef.current) {
      console.log("Destroying existing HLS player");
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const handleVideoError = () => {
      const mediaError = video.error;
      console.error("Video element error:", mediaError);
    };

    const handleStalled = () => {
      console.warn("Video stalled");
    };

    const handleWaiting = () => {
      console.warn("Video waiting for data");
    };

    const handlePlaying = () => {
      console.log("Video playing");
    };

    const handleLoadedMetadata = () => {
      console.log("Loaded metadata");
    };

    video.addEventListener("error", handleVideoError);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    const setupPlayer = async () => {
      // Start muted to comply with autoplay policies
      video.muted = true;

      const canUseHlsJs = Hls.isSupported();
      const canUseNative = video.canPlayType("application/vnd.apple.mpegurl");
      console.log("HLS support check:", { canUseHlsJs, canUseNative });

      if (canUseHlsJs) {
        // Prefer HLS.js when supported (avoids false positives from canPlayType)
        console.log("Using HLS.js");
        hlsRef.current = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          debug: true,
        });

        hlsRef.current.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log("HLS media attached");
        });

        hlsRef.current.on(Hls.Events.MANIFEST_LOADING, (_event: unknown, data: { url?: string }) => {
          console.log("HLS manifest loading:", data?.url);
        });

        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed, starting playback");
          setStreamStatus("connected");
          video.play().catch(err => console.log("Autoplay blocked:", err.message));
        });

        hlsRef.current.on(Hls.Events.LEVEL_LOADED, (_event: unknown, data: { details?: { totalduration?: number } }) => {
          console.log("HLS level loaded, duration:", data?.details?.totalduration);
        });

        hlsRef.current.on(
          Hls.Events.ERROR,
          (_event: unknown, data: { fatal?: boolean; type?: string; response?: { code?: number } }) => {
            if (data.response?.code === 412) {
              console.warn("HLS manifest not ready (412), retrying...");
              setStreamStatus("waiting");
              setTimeout(() => {
                if (hlsRef.current) {
                  hlsRef.current.loadSource(playbackUrl);
                }
              }, 3000);
              return;
            }

          if (data.fatal) {
            console.error("HLS fatal error:", data);
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
          }
        );

        hlsRef.current.loadSource(playbackUrl);
        hlsRef.current.attachMedia(video);
      } else if (canUseNative) {
        // Native HLS support (Safari/iOS)
        console.log("Using native HLS support");
        video.src = playbackUrl;
        setStreamStatus("connected");
        video.play().catch(err => console.log("Autoplay blocked:", err.message));
      } else {
        console.error("HLS not supported in this browser");
      }

    };

    setupPlayer();

    return () => {
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
        if (savedCredentials.provider === "mux") {
          try {
            const enableResponse = await fetch("/api/stream/enable", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ streamId: savedCredentials.streamId }),
            });

            if (!enableResponse.ok) {
              const error = await enableResponse.json();
              console.warn("Failed to enable Mux live stream:", error);
            }
          } catch (error) {
            console.warn("Failed to enable Mux live stream:", error);
          }
        }

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
    if (!activeStream || !user) return;
    setIsLoading(true);
    const streamSnapshot = activeStream;
    try {
      console.log("Ending stream with ID:", streamSnapshot.streamId);

      await endStream({ streamId: streamSnapshot._id });
      if (streamSnapshot.streamId) {
        try {
          await createVideo({
            userId: streamSnapshot.userId,
            title: streamSnapshot.title,
            description: streamSnapshot.description,
            provider: "mux",
            assetId: `pending:${streamSnapshot.streamId}`,
            visibility: "public",
          });
        } catch (error) {
          console.warn("[stream/end] Failed to create placeholder recording:", error);
        }
      }
      setStreamStep("idle");
      setPreviewStream(null);
      setHasAudio(false);
      setStreamStatus("waiting");
      alert("Stream ended! Recording is processing and will appear in MY LIBRARY shortly.");
    } catch (error) {
      console.error("Failed to end stream:", error);
      alert(error instanceof Error ? error.message : "Failed to end stream");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/stream/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: streamSnapshot.streamId, skipAssetPolling: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disable stream in Mux");
      }

      const assetData = await response.json();
      if (assetData.assetId) {
        await upsertMuxAsset({
          assetId: assetData.assetId,
          userId: streamSnapshot.userId,
          title: streamSnapshot.title,
          description: streamSnapshot.description,
          playbackId: assetData.playbackId,
          duration: assetData.duration,
          status: assetData.playbackId ? "ready" : "processing",
          visibility: "public",
          liveStreamId: streamSnapshot.streamId,
        });
      }
    } catch (error) {
      console.warn("[stream/end] Failed to disable stream or seed asset:", error);
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
      <MainNav />

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
                {previewStream.streamId && (
                  <p className="text-xs text-zinc-600 mt-1">Stream ID: {previewStream.streamId}</p>
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

              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                <h3 className="font-bold mb-3 text-sm text-zinc-400">STREAM INFO</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-zinc-500 mb-1">Stream ID:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {previewStream.streamId}
                    </code>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1">Playback URL:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all font-mono">
                      {previewStream.playbackUrl}
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
                {!isTitleEditing ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white">
                      {activeStream.title}
                    </div>
                    <button
                      onClick={() => {
                        setEditingTitle(activeStream.title);
                        setIsTitleEditing(true);
                      }}
                      className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-white"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await updateStreamTitle({
                        streamId: activeStream._id,
                        title: editingTitle,
                      });
                      setIsTitleEditing(false);
                    }}
                    className="flex flex-col gap-2"
                  >
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-lime-400 transition-colors"
                      placeholder="Enter stream title..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-lime-400 text-black font-semibold rounded-xl hover:bg-lime-300 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTitleEditing(false)}
                        className="flex-1 px-4 py-2 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
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
