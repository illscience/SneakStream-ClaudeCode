"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageCircle, Send, Users } from "lucide-react"
import { AvatarCarousel } from "@/components/avatar-carousel"
import { ChatMessage } from "@/components/chat-message"

type Message = {
  id: string
  username: string
  text: string
  timestamp: string
  avatar?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", username: "Anonymous", text: "Hey", timestamp: "today" },
    { id: "2", username: "Anonymous", text: "Yo", timestamp: "today" },
    { id: "3", username: "illsci", text: "hello", timestamp: "today" },
    { id: "4", username: "illsci", text: "view", timestamp: "today" },
    { id: "5", username: "illsci", text: "hello", timestamp: "today" },
    { id: "6", username: "illsci", text: "hi", timestamp: "today" },
    { id: "7", username: "illsci", text: "hi", timestamp: "today" },
  ])
  const [currentMessage, setCurrentMessage] = useState("")
  const [currentUsername] = useState("illsci")
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>()

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        username: currentUsername,
        text: currentMessage,
        timestamp: "today",
        avatar: selectedAvatar,
      }
      setMessages([newMessage, ...messages])
      setCurrentMessage("")
    }
  }

  const handleAvatarSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl)
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header with Avatar Carousel */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-8 h-8 text-[#c4ff0e]" strokeWidth={2} />
            <h1 className="text-2xl font-bold text-white">LIVE CHAT</h1>
          </div>
          <AvatarCarousel onAvatarSelect={handleAvatarSelect} />
          <Link
            href="/"
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#ff00ff] text-white rounded-lg hover:bg-[#e600e6] transition-colors font-medium"
          >
            <Users className="w-5 h-5" />
            Nightclub
          </Link>
        </div>

        {/* Current User Info */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-gray-400">Chatting as:</span>
          <span className="text-[#c4ff0e] font-medium">{currentUsername}</span>
          {selectedAvatar && (
            <img
              src={selectedAvatar || "/placeholder.svg"}
              alt="Your avatar"
              className="w-8 h-8 rounded-full border-2 border-[#c4ff0e]"
            />
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#1a1a1a] text-white px-6 py-4 rounded-2xl border border-gray-800 focus:outline-none focus:border-[#c4ff0e] transition-colors"
          />
          <button
            onClick={handleSendMessage}
            className="bg-[#c4ff0e] text-black px-8 py-4 rounded-2xl hover:bg-[#b3e60d] transition-colors flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  )
}
