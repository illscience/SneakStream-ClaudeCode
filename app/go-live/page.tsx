"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Radio, Video, Settings, X, Monitor, Mic, Users, MessageSquare, Save } from "lucide-react";

export default function GoLivePage() {
  const { user } = useUser();
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Stream Settings
  const [videoQuality, setVideoQuality] = useState("1080p");
  const [videoBitrate, setVideoBitrate] = useState("6000");
  const [audioBitrate, setAudioBitrate] = useState("320");
  const [audioSampleRate, setAudioSampleRate] = useState("48000");
  const [chatEnabled, setChatEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeInterval, setSlowModeInterval] = useState("5");
  const [recordStream, setRecordStream] = useState(true);
  const [visibility, setVisibility] = useState("public");

  // Get current live stream
  const activeStream = useQuery(api.livestream.getActiveStream);

  // Mutations
  const startStream = useMutation(api.livestream.startStream);
  const endStream = useMutation(api.livestream.endStream);

  const handleGoLive = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // First, create a LivePeer stream
      const streamResponse = await fetch("/api/stream/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: streamTitle || "Live Stream",
        }),
      });

      if (!streamResponse.ok) {
        throw new Error("Failed to create LivePeer stream");
      }

      const streamData = await streamResponse.json();

      // Then, save it to Convex
      await startStream({
        userId: user.id,
        userName: user.fullName || user.username || "Anonymous",
        title: streamTitle || "Live Stream",
        description: streamDescription,
        livepeerStreamId: streamData.streamId,
        streamKey: streamData.streamKey,
        playbackId: streamData.playbackId,
        playbackUrl: streamData.playbackUrl,
        rtmpIngestUrl: streamData.rtmpIngestUrl,
      });

      setStreamTitle("");
      setStreamDescription("");
    } catch (error) {
      console.error("Failed to start stream:", error);
      alert("Failed to start stream. Please try again.");
    }
    setIsLoading(false);
  };

  const handleEndStream = async () => {
    if (!activeStream) return;

    setIsLoading(true);
    try {
      await endStream({ streamId: activeStream._id });
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <a href="/" className="text-xl font-bold hover:text-lime-400 transition-colors">
            DJ SNEAK
          </a>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">Go Live</span>
        </div>
        <a href="/" className="text-zinc-400 hover:text-white">
          <X className="w-6 h-6" />
        </a>
      </header>

      <main className="pt-24 px-8 pb-16 max-w-4xl mx-auto">
        {/* Live Status Banner */}
        {activeStream && (
          <div className="mb-8 p-6 bg-red-600/20 border border-red-600 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <div>
                  <h3 className="font-bold">You&apos;re Live!</h3>
                  <p className="text-sm text-zinc-300">Broadcasting to all viewers</p>
                </div>
              </div>
              <button
                onClick={handleEndStream}
                disabled={isLoading}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-medium transition-colors disabled:opacity-50"
              >
                End Stream
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-red-600/30">
              <p className="text-sm font-medium">{activeStream.title}</p>
              {activeStream.description && (
                <p className="text-sm text-zinc-400 mt-1">{activeStream.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Go Live Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center">
              <Radio className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Start Broadcasting</h1>
              <p className="text-zinc-400">Take over the main stream and broadcast to all viewers</p>
            </div>
          </div>

          {!activeStream && (
            <div className="space-y-6">
              {/* Stream Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="e.g., Late Night Mix Session"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-lime-400 transition-colors"
                />
              </div>

              {/* Stream Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  placeholder="Tell viewers what you'll be playing..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-lime-400 transition-colors resize-none"
                />
              </div>

              {/* Stream Settings */}
              <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-lime-400" />
                  <h3 className="font-bold text-lg">Stream Settings</h3>
                </div>

                {/* Video Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                    <Monitor className="w-4 h-4" />
                    <span>Video Settings</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2">Quality</label>
                      <select
                        value={videoQuality}
                        onChange={(e) => setVideoQuality(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                      >
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="1440p">1440p (2K)</option>
                        <option value="2160p">2160p (4K)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Bitrate (kbps)</label>
                      <input
                        type="number"
                        value={videoBitrate}
                        onChange={(e) => setVideoBitrate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Audio Settings */}
                <div className="space-y-4 pt-4 border-t border-zinc-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                    <Mic className="w-4 h-4" />
                    <span>Audio Settings</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2">Bitrate (kbps)</label>
                      <select
                        value={audioBitrate}
                        onChange={(e) => setAudioBitrate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                      >
                        <option value="128">128 kbps</option>
                        <option value="192">192 kbps</option>
                        <option value="256">256 kbps</option>
                        <option value="320">320 kbps</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2">Sample Rate (Hz)</label>
                      <select
                        value={audioSampleRate}
                        onChange={(e) => setAudioSampleRate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                      >
                        <option value="44100">44.1 kHz</option>
                        <option value="48000">48 kHz</option>
                        <option value="96000">96 kHz</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Chat Settings */}
                <div className="space-y-4 pt-4 border-t border-zinc-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat Settings</span>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Enable Chat</span>
                      <input
                        type="checkbox"
                        checked={chatEnabled}
                        onChange={(e) => setChatEnabled(e.target.checked)}
                        className="w-5 h-5 accent-lime-400"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-sm">Slow Mode</span>
                      <input
                        type="checkbox"
                        checked={slowMode}
                        onChange={(e) => setSlowMode(e.target.checked)}
                        className="w-5 h-5 accent-lime-400"
                      />
                    </label>

                    {slowMode && (
                      <div>
                        <label className="block text-sm mb-2">Message Interval (seconds)</label>
                        <input
                          type="number"
                          value={slowModeInterval}
                          onChange={(e) => setSlowModeInterval(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Privacy & Recording */}
                <div className="space-y-4 pt-4 border-t border-zinc-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                    <Users className="w-4 h-4" />
                    <span>Privacy & Recording</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm mb-2">Visibility</label>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 text-sm"
                      >
                        <option value="public">Public - Anyone can watch</option>
                        <option value="followers">Followers Only</option>
                        <option value="private">Private - Invite only</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between">
                      <span className="text-sm">Record Stream</span>
                      <input
                        type="checkbox"
                        checked={recordStream}
                        onChange={(e) => setRecordStream(e.target.checked)}
                        className="w-5 h-5 accent-lime-400"
                      />
                    </label>
                  </div>
                </div>

                {/* Save Settings Button */}
                <button className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                  <Save className="w-4 h-4" />
                  Save Settings as Default
                </button>
              </div>

              {/* Stream Settings Info */}
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-lime-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">Stream Configuration</h3>
                    <ul className="text-sm text-zinc-400 space-y-1">
                      <li>• Your stream will overtake the main broadcast</li>
                      <li>• All viewers will be redirected to your stream</li>
                      <li>• Chat will remain active during your broadcast</li>
                      <li>• Click "End Stream" when you&apos;re done to restore normal programming</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Go Live Button */}
              <button
                onClick={handleGoLive}
                disabled={isLoading || !streamTitle.trim()}
                className="w-full py-4 bg-lime-400 text-black font-bold rounded-full hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                {isLoading ? "Starting..." : "Go Live"}
              </button>
            </div>
          )}

          {activeStream && (
            <div className="space-y-6">
              {/* Streaming Instructions */}
              <div className="p-6 bg-lime-400/10 border border-lime-400/30 rounded-xl">
                <h3 className="font-bold mb-3 text-lime-400">Setup Your Broadcast Software</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-zinc-400 mb-1">Stream URL (RTMP):</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all">
                      {activeStream.rtmpIngestUrl || "rtmp://rtmp.livepeer.com/live"}
                    </code>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-1">Stream Key:</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all">
                      {activeStream.streamKey || activeStream._id}
                    </code>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-1">Playback URL (for testing):</p>
                    <code className="block px-3 py-2 bg-zinc-900 rounded border border-zinc-700 text-lime-400 break-all">
                      {activeStream.playbackUrl || `https://livepeercdn.studio/hls/${activeStream.playbackId}/index.m3u8`}
                    </code>
                  </div>
                  <p className="text-zinc-400 italic">
                    Use OBS, Streamlabs, or any RTMP-compatible software to start broadcasting
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <h3 className="font-bold mb-3">Need Help?</h3>
          <div className="text-sm text-zinc-400 space-y-2">
            <p>• Download OBS Studio (free) from obsproject.com</p>
            <p>• Add your stream URL and key to OBS settings</p>
            <p>• Configure your audio sources (DJ equipment, microphone)</p>
            <p>• Click "Start Streaming" in OBS once you&apos;re ready</p>
            <p>• Your broadcast will appear on the main page instantly</p>
          </div>
        </div>
      </main>
    </div>
  );
}
