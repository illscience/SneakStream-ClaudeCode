"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MessageSquare, Send } from "lucide-react";

export default function ChatWindow() {
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("Anonymous");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useQuery(api.chat.getMessages);
  const sendMessage = useMutation(api.chat.sendMessage);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await sendMessage({ user: username, body: newMessage });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-lime-400" />
        <h3 className="text-sm text-zinc-400 uppercase">Live Chat</h3>
      </div>

      {/* Messages Container */}
      <div className="flex-1 bg-zinc-900/50 rounded-xl overflow-y-auto mb-4 p-4 space-y-3 max-h-[400px]">
        {messages?.map((message, idx) => (
          <div key={message._id} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-lime-400">
                {message.user || "Anonymous"}
              </span>
              <span className="text-xs text-zinc-600">·</span>
            </div>
            <p className="text-sm text-white break-words">{message.body}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Username Display/Edit */}
      <div className="mb-2 flex items-center gap-2">
        {isEditingUsername ? (
          <input
            type="text"
            defaultValue={username}
            placeholder="Enter your name"
            autoFocus
            className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const newName = e.currentTarget.value.trim();
                setUsername(newName || "Anonymous");
                setIsEditingUsername(false);
              }
            }}
            onBlur={(e) => {
              const newName = e.currentTarget.value.trim();
              setUsername(newName || "Anonymous");
              setIsEditingUsername(false);
            }}
          />
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-zinc-400">Chatting as:</span>
            <span className="text-sm font-medium text-lime-400">{username}</span>
            <button
              onClick={() => setIsEditingUsername(true)}
              className="text-xs text-zinc-500 hover:text-lime-400 underline"
            >
              change
            </button>
          </div>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-lime-400 text-black rounded-lg font-medium hover:bg-lime-300 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
