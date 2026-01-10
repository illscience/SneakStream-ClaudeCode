"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Radio, Video, Settings, Monitor, Mic, Users, MessageSquare, Save } from "lucide-react";
import MainNav from "@/components/navigation/MainNav";

export default function LivepeerGoLivePage() {
  const { user } = useUser();
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [videoQuality, setVideoQuality] = useState("1080p");
  const [videoBitrate, setVideoBitrate] = useState("6000");
  const [audioBitrate, setAudioBitrate] = useState("320");
  const [audioSampleRate, setAudioSampleRate] = useState("48000");
  const [chatEnabled, setChatEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeInterval, setSlowModeInterval] = useState("5");
  const [recordStream, setRecordStream] = useState(true);
  const [visibility, setVisibility] = useState("public");

  const activeStream = useQuery(api.livestream.getActiveStream);
  const startStream = useMutation(api.livestream.startStream);
  const endStream = useMutation(api.livestream.endStream);

  const handleGoLive = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const streamResponse = await fetch("/api/stream/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: streamTitle || "Live Stream", provider: "livepeer" }),
      });

      if (!streamResponse.ok) {
        const error = await streamResponse.json();
        throw new Error(error.error || "Failed to create Livepeer stream");
      }

      const streamData = await streamResponse.json();

      await startStream({
        userId: user.id,
        userName: user.fullName || user.username || "Anonymous",
        title: streamTitle || "Live Stream",
        description: streamDescription,
        provider: "livepeer",
        streamId: streamData.streamId,
        streamKey: streamData.streamKey,
        playbackId: streamData.playbackId,
        playbackUrl: streamData.playbackUrl,
        rtmpIngestUrl: streamData.rtmpIngestUrl,
      });

      setStreamTitle("");
      setStreamDescription("");
    } catch (error) {
      console.error("Failed to start stream:", error);
      alert(error instanceof Error ? error.message : "Failed to start stream");
    }
    setIsLoading(false);
  };

  const handleEndStream = async () => {
    if (!activeStream) return;
    setIsLoading(true);
    try {
      await endStream({ streamId: activeStream._id, userId: user?.id });
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
      <MainNav />

      <main className="pt-24 px-8 pb-16 max-w-4xl mx-auto">
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
              <div>
                <label className="block text-sm font-medium mb-2">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(event) => setStreamTitle(event.target.value)}
                  placeholder="The Warehouse Session"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={streamDescription}
                  onChange={(event) => setStreamDescription(event.target.value)}
                  rows={4}
                  placeholder="Share what you&apos;re playing, shout outs, or any special guests!"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-lime-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                      <Monitor className="w-4 h-4" />
                      <span>Video Settings</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm">
                        Quality
                        <select
                          value={videoQuality}
                          onChange={(event) => setVideoQuality(event.target.value)}
                          className="mt-1 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                        >
                          <option value="1080p">1080p (Recommended)</option>
                          <option value="720p">720p</option>
                          <option value="480p">480p</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        Video Bitrate (kbps)
                        <input
                          type="number"
                          value={videoBitrate}
                          onChange={(event) => setVideoBitrate(event.target.value)}
                          className="mt-1 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                      <Mic className="w-4 h-4" />
                      <span>Audio Settings</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm">
                        Audio Bitrate (kbps)
                        <input
                          type="number"
                          value={audioBitrate}
                          onChange={(event) => setAudioBitrate(event.target.value)}
                          className="mt-1 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        Sample Rate (Hz)
                        <input
                          type="number"
                          value={audioSampleRate}
                          onChange={(event) => setAudioSampleRate(event.target.value)}
                          className="mt-1 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                      <MessageSquare className="w-4 h-4" />
                      <span>Chat Settings</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm">Enable Chat</span>
                        <input
                          type="checkbox"
                          checked={chatEnabled}
                          onChange={(event) => setChatEnabled(event.target.checked)}
                          className="w-5 h-5 accent-lime-400"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <div className="text-sm">
                          <p>Slow Mode</p>
                          <p className="text-xs text-zinc-500">Limit messages from the same user</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={slowMode}
                            onChange={(event) => setSlowMode(event.target.checked)}
                            className="w-5 h-5 accent-lime-400"
                          />
                          <input
                            type="number"
                            min="3"
                            value={slowModeInterval}
                            onChange={(event) => setSlowModeInterval(event.target.value)}
                            className="w-20 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                          />
                          <span className="text-xs text-zinc-500">seconds</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-lime-400">
                      <Users className="w-4 h-4" />
                      <span>Privacy & Recording</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm mb-2">Visibility</label>
                        <select
                          value={visibility}
                          onChange={(event) => setVisibility(event.target.value)}
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
                          onChange={(event) => setRecordStream(event.target.checked)}
                          className="w-5 h-5 accent-lime-400"
                        />
                      </label>
                    </div>
                  </div>

                  <button className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                    <Save className="w-4 h-4" />
                    Save Settings as Default
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-lime-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">Stream Configuration</h3>
                    <ul className="text-sm text-zinc-400 space-y-1">
                      <li>• Your stream will overtake the main broadcast</li>
                      <li>• All viewers will be redirected to your stream</li>
                      <li>• Chat will remain active during your broadcast</li>
                      <li>• Click &quot;End Stream&quot; when you&apos;re done to restore normal programming</li>
                    </ul>
                  </div>
                </div>
              </div>

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

        <div className="mt-8 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <h3 className="font-bold mb-3">Need Help?</h3>
          <div className="text-sm text-zinc-400 space-y-2">
            <p>• Download OBS Studio (free) from obsproject.com</p>
            <p>• Add your stream URL and key to OBS settings</p>
            <p>• Configure your audio sources (DJ equipment, microphone)</p>
            <p>• Click &quot;Start Streaming&quot; in OBS once you&apos;re ready</p>
            <p>• Your broadcast will appear on the main page instantly</p>
          </div>
        </div>
      </main>
    </div>
  );
}
