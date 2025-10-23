"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { MessageSquare, Send, Trash2 } from "lucide-react"

export default function LiveChat() {
  const { user } = useUser()
  const [newMessage, setNewMessage] = useState("")
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set())

  // Chat functionality
  const messages = useQuery(api.chat.getMessages)
  const sendMessage = useMutation(api.chat.sendMessage)
  const deleteMessage = useMutation(api.chat.deleteMessage)
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  )

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous"
  const userSelectedAvatar = convexUser?.selectedAvatar || null
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "illscience@gmail.com"

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) {
      return "just now"
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return `${mins}m ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    const messageText = newMessage.trim()
    const optimisticId = `optimistic-${Date.now()}`

    const optimisticMsg = {
      _id: optimisticId,
      _creationTime: Date.now(),
      user: user.id,
      userId: user.id,
      userName: displayName,
      avatarUrl: userSelectedAvatar || undefined,
      body: messageText,
    }

    setOptimisticMessages((prev) => [...prev, optimisticMsg])
    setNewMessage("")

    try {
      await sendMessage({
        user: user.id,
        userId: user.id,
        userName: displayName,
        avatarUrl: userSelectedAvatar || undefined,
        body: messageText,
      })
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    } catch (error) {
      console.error("Failed to send message:", error)
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-6 h-6 text-[#c4ff0e]" />
        <h2 className="text-2xl font-bold text-[#c4ff0e]">Live Chat</h2>
      </div>

      {userSelectedAvatar && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-400">Your avatar:</span>
          <img
            src={userSelectedAvatar}
            alt="Selected"
            className="w-8 h-8 rounded-full border-2 border-[#ff00ff]"
            style={{ boxShadow: "0 0 8px rgba(255, 0, 255, 0.4)" }}
          />
          <span className="text-sm font-medium text-[#c4ff0e]">{displayName}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#c4ff0e] border border-zinc-800"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c4ff0e] text-black transition-colors hover:bg-[#b3e60d]"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        {[...(messages || []), ...optimisticMessages]
          .filter((message) => !deletedMessageIds.has(message._id))
          .slice()
          .reverse()
          .map((message) => (
          <div key={message._id} className="flex gap-3 group">
            {message.avatarUrl && (
              <img
                src={message.avatarUrl}
                alt={message.userName || "User"}
                className="w-10 h-10 rounded-full border-2 border-[#ff00ff] flex-shrink-0"
                style={{ boxShadow: "0 0 8px rgba(255, 0, 255, 0.4)" }}
              />
            )}
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-[#c4ff0e]">
                  {message.userName || message.user || "Anonymous"}
                </span>
                <span className="text-xs text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">
                  {formatTimestamp(message._creationTime)}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setDeletedMessageIds((prev) => new Set(prev).add(message._id))
                      deleteMessage({ messageId: message._id }).catch((error) => {
                        console.error("Failed to delete message:", error)
                        setDeletedMessageIds((prev) => {
                          const newSet = new Set(prev)
                          newSet.delete(message._id)
                          return newSet
                        })
                      })
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-500 ml-auto"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-sm text-white break-words">{message.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

