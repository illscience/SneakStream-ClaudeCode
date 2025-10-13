"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MessageSquare, Send } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import NightclubPanel from "./nightclub/NightclubPanel";
import VideoFeed from "./VideoFeed";

export default function ChatWindow() {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  const [viewMode, setViewMode] = useState<"nightclub" | "chat">("nightclub");
  const messages = useQuery(api.chat.getMessages);
  const sendMessage = useMutation(api.chat.sendMessage);

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("chatViewMode");
    if (stored === "chat" || stored === "nightclub") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chatViewMode", viewMode);
  }, [viewMode]);

  // No auto-scroll - keep focus at the top where input is

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours === 1) return "1 hour ago";
    if (hours < 4) return `${hours} hours ago`;
    if (hours < 24) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return "last week";
    if (days < 60) return "last month";
    return "a while ago";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage({
        user: displayName,
        userId: user?.id,
        userName: displayName,
        avatarUrl: user?.imageUrl,
        body: newMessage
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const renderChatView = () => (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-white/10 bg-black/70 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-lime-400" />
          <h3 className="text-sm text-zinc-400 uppercase tracking-wide">Live Chat</h3>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Chatting as</span>
          <span className="rounded-full bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
            {displayName}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <button
            type="submit"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-black transition-colors hover:bg-lime-300 sm:h-auto sm:min-w-[120px] sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-white/5 bg-black/60 p-4">
          <div className="space-y-3">
            {messages?.slice().reverse().map((message) => (
              <div key={message._id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-lime-300">
                    {message.userName || message.user || "Anonymous"}
                  </span>
                  <span className="text-xs text-zinc-600">•</span>
                  <span className="text-xs text-zinc-500">
                    {formatTimestamp(message._creationTime)}
                  </span>
                </div>
                <p className="text-sm text-white break-words">{message.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/60 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Recommended Sets
        </h3>
        <div className="mt-4">
          <VideoFeed limit={5} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Community Mode</span>
        </div>
        <div className="flex rounded-full bg-white/5 p-1 text-xs font-semibold uppercase">
          <button
            onClick={() => setViewMode("nightclub")}
            className={`rounded-full px-4 py-2 transition ${
              viewMode === "nightclub"
                ? "bg-lime-400 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Nightclub
          </button>
          <button
            onClick={() => setViewMode("chat")}
            className={`rounded-full px-4 py-2 transition ${
              viewMode === "chat"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Chat Feed
          </button>
        </div>
      </div>

      {viewMode === "nightclub" ? <NightclubPanel /> : renderChatView()}
    </div>
  );
}
