"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Image as ImageIcon, Loader2, MessageSquare, Send, Trash2 } from "lucide-react"

export default function LiveChat() {
  const { user } = useUser()
  const [newMessage, setNewMessage] = useState("")
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set())
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Chat functionality
  const messages = useQuery(api.chat.getMessages)
  const sendMessage = useMutation(api.chat.sendMessage)
  const deleteMessage = useMutation(api.chat.deleteMessage)
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl)
  const remixImageToGif = useAction(api.remix.remixImageToGif)
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  )

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous"
  const userSelectedAvatar = convexUser?.selectedAvatar || null
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "illscience@gmail.com"
  const resolvedAvatar = userSelectedAvatar || user?.imageUrl || undefined
  const [remixingId, setRemixingId] = useState<string | null>(null)

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !imageFile) || !user || isSending) return

    const messageText = newMessage.trim()
    const optimisticId = `optimistic-${Date.now()}`

    const optimisticMsg = {
      _id: optimisticId,
      _creationTime: Date.now(),
      user: user.id,
      userId: user.id,
      userName: displayName,
      avatarUrl: resolvedAvatar,
      body: messageText,
      imageUrl: imagePreview || undefined,
    }

    setOptimisticMessages((prev) => [...prev, optimisticMsg])
    setNewMessage("")
    setIsSending(true)

    try {
      let uploadedStorageId: Id<"_storage"> | undefined
      let uploadedMimeType: string | undefined

      if (imageFile) {
        const mimeType =
          imageFile.type ||
          (imageFile.name?.toLowerCase().endsWith(".gif") ? "image/gif" : "application/octet-stream")
        uploadedMimeType = mimeType
        const { uploadUrl } = await generateUploadUrl({})
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": mimeType,
          },
          body: imageFile,
        })

        if (!uploadRes.ok) {
          throw new Error("Image upload failed")
        }

        const { storageId } = await uploadRes.json()
        uploadedStorageId = storageId
      }

      await sendMessage({
        user: user.id,
        userId: user.id,
        userName: displayName,
        avatarUrl: resolvedAvatar,
        body: messageText || "",
        imageStorageId: uploadedStorageId,
        imageMimeType: uploadedMimeType || imageFile?.type,
      })
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
      setImageFile(null)
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
      setImagePreview(null)
    } catch (error) {
      console.error("Failed to send message:", error)
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
      setNewMessage(messageText)
    } finally {
      setIsSending(false)
    }
  }

  const handleImageSelection = (file: File) => {
    if (!file.type.startsWith("image/")) return
    const MAX_IMAGE_SIZE = 8 * 1024 * 1024 // 8MB
    if (file.size > MAX_IMAGE_SIZE) {
      alert("Image is too large. Please choose a file under 8MB.")
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImageSelection(file)
    }
    event.target.value = ""
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const fileItem = Array.from(event.clipboardData?.items || []).find((item) =>
      item.type.startsWith("image/")
    )
    if (fileItem) {
      const file = fileItem.getAsFile()
      if (file) {
        event.preventDefault()
        handleImageSelection(file)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const handleRemix = async (messageId: Id<"messages">) => {
    const prompt = window.prompt("Enter a remix prompt (optional):", "") || undefined
    try {
      setRemixingId(String(messageId))
      await remixImageToGif({
        messageId,
        prompt,
        userId: user?.id,
        userName: displayName,
        avatarUrl: resolvedAvatar,
      })
    } catch (error) {
      console.error("Failed to remix image:", error)
      alert("Remix failed. Please try again.")
    } finally {
      setRemixingId(null)
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

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4 items-start">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-300 transition-colors hover:text-white hover:border-[#c4ff0e]"
          title="Attach image"
        >
          <ImageIcon className="h-5 w-5" />
        </button>
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder="Type a message or paste an image..."
            className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#c4ff0e] border border-zinc-800 min-h-[44px] resize-none"
            rows={2}
          />
          {imagePreview && (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-16 w-16 rounded-md border border-zinc-700 object-cover"
              />
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">Image ready to send</span>
                <button
                  type="button"
                  onClick={() => {
                    if (imagePreview) URL.revokeObjectURL(imagePreview)
                    setImagePreview(null)
                    setImageFile(null)
                  }}
                  className="text-xs text-zinc-400 hover:text-white underline"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isSending || (!newMessage.trim() && !imageFile)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c4ff0e] text-black transition-colors hover:bg-[#b3e60d] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        {[...(messages || []), ...optimisticMessages]
          .filter((message) => !deletedMessageIds.has(message._id))
          .slice()
          .reverse()
          .map((message) => (
          <div key={message._id} className="flex gap-3 group">
            <div className="w-10 h-10 rounded-full border-2 border-[#ff00ff] flex-shrink-0 overflow-hidden flex items-center justify-center bg-black/40 text-[#c4ff0e] font-semibold"
              style={{ boxShadow: "0 0 8px rgba(255, 0, 255, 0.4)" }}>
              {message.avatarUrl ? (
                <img
                  src={message.avatarUrl}
                  alt={message.userName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm">
                  {(message.userName || message.user || "A").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
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
              {message.body && message.body.trim().length > 0 && (
                <p className="text-sm text-white break-words">{message.body}</p>
              )}
              {message.remixOf && (
                <span className="text-xs text-zinc-500">Remix of {message.remixOf}</span>
              )}
              {message.imageUrl && (
                <div className="mt-2 max-w-full space-y-2">
                  {message.imageMimeType?.startsWith("video/") ? (
                    <video
                      src={message.imageUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="max-h-64 w-full max-w-md rounded-xl border border-zinc-800 object-contain bg-black/40"
                    />
                  ) : (
                    <img
                      src={message.imageUrl}
                      alt="Shared in chat"
                      loading="lazy"
                      className="max-h-64 w-full max-w-md rounded-xl border border-zinc-800 object-contain bg-black/40"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemix(message._id)}
                    disabled={remixingId === message._id}
                    className="text-xs px-3 py-1 rounded-full border border-zinc-800 text-zinc-300 hover:text-white hover:border-lime-400 transition disabled:opacity-50 disabled:cursor-not-allowed w-fit"
                  >
                    {remixingId === message._id ? "Remixing..." : "Remix"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
