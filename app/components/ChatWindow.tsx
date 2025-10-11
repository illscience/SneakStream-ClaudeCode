"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MessageSquare, Send } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function ChatWindow() {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useQuery(api.chat.getMessages);
  const sendMessage = useMutation(api.chat.sendMessage);

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous";

  // No auto-scroll - keep focus at the top where input is

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-lime-400" />
        <h3 className="text-sm text-zinc-400 uppercase">Live Chat</h3>
      </div>

      {/* Username Display */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-zinc-400">Chatting as:</span>
          <span className="text-sm font-medium text-lime-400">{displayName}</span>
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-black transition-colors hover:bg-lime-300 sm:h-auto sm:min-w-[120px] sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Messages Container - Reverse Chronological */}
      <div className="flex-1 bg-zinc-900/50 rounded-xl overflow-y-auto p-4 space-y-3 max-h-[400px]">
        {messages?.slice().reverse().map((message) => (
          <div key={message._id} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-lime-400">
                {message.userName || message.user || "Anonymous"}
              </span>
              <span className="text-xs text-zinc-600">·</span>
            </div>
            <p className="text-sm text-white break-words">{message.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
