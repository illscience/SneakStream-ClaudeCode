"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { SignInButton, useUser } from "@clerk/nextjs"
import { usePaginatedQuery, useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { EMOTE_BY_ID, EMOTES } from "@/lib/emotes"
import { Heart, Image as ImageIcon, Loader2, MessageSquare, Send, Smile, Trash2 } from "lucide-react"

const GIF_URL_PATTERN =
  /https?:\/\/[^\s]+\.gif(\?[^\s]*)?|https?:\/\/(media\.giphy\.com|giphy\.com|media\.tenor\.com|tenor\.com|imgur\.com|i\.imgur\.com)\/[^\s]+/gi

const normalizeGifUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace(/^www\./, "")
    const path = url.pathname
    const lastSegment = path.split("/").filter(Boolean).pop() ?? ""

    if (path.toLowerCase().endsWith(".gif")) {
      return rawUrl
    }

    if (host === "giphy.com" || host === "media.giphy.com") {
      const id =
        (path.match(/\/media\/([^/]+)/)?.[1] ?? lastSegment.split("-").pop()) || ""
      return id ? `https://media.giphy.com/media/${id}/giphy.gif` : rawUrl
    }

    if (host === "tenor.com" || host === "media.tenor.com") {
      const itemId = url.searchParams.get("itemid")
      const id = itemId ?? lastSegment.split("-").pop()
      return id ? `https://media.tenor.com/${id}/tenor.gif` : rawUrl
    }

    if (host === "imgur.com") {
      return lastSegment ? `https://i.imgur.com/${lastSegment}.gif` : rawUrl
    }

    if (host === "i.imgur.com") {
      return rawUrl
    }

    return rawUrl
  } catch {
    return rawUrl
  }
}

const extractGifUrls = (body: string) => {
  const matches = body.match(GIF_URL_PATTERN) ?? []
  const urls = Array.from(
    new Set(matches.map((match) => normalizeGifUrl(match.trim())))
  ).filter(Boolean)
  const text = body.replace(GIF_URL_PATTERN, " ").replace(/\s{2,}/g, " ").trim()
  return { text, urls }
}

export default function LiveChat() {
  const { user } = useUser()
  const [newMessage, setNewMessage] = useState("")
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set())
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isEmotePickerOpen, setIsEmotePickerOpen] = useState(false)
  const [loveAnimatingId, setLoveAnimatingId] = useState<string | null>(null)
  const [mentionSearch, setMentionSearch] = useState("")
  const [showMentionPopup, setShowMentionPopup] = useState(false)
  const [mentionPosition, setMentionPosition] = useState<number | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const hasSyncedUserRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Chat functionality
  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.chat.getMessagesPage,
    {},
    { initialNumItems: 30 }
  )
  const sendMessage = useMutation(api.chat.sendMessage)
  const deleteMessage = useMutation(api.chat.deleteMessage)
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl)
  const loveMessage = useMutation(api.chat.loveMessage)
  const upsertUser = useMutation(api.users.upsertUser)
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  )
  const mentionResults = useQuery(
    api.users.searchUsersByAlias,
    showMentionPopup ? { searchTerm: mentionSearch } : "skip"
  )

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous"
  const userSelectedAvatar = convexUser?.selectedAvatar || null
  const isAdmin =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() === "sneakthedj@gmail.com"
  const resolvedAvatar = userSelectedAvatar || user?.imageUrl || undefined
  const isSignedIn = Boolean(user?.id)

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

  const handleLove = async (messageId: string) => {
    if (!user?.id) return
    setLoveAnimatingId(messageId)
    setTimeout(() => setLoveAnimatingId(null), 300)
    try {
      await loveMessage({ messageId: messageId as Id<"messages">, clerkId: user.id })
    } catch (error) {
      console.error("Failed to love message:", error)
    }
  }

  const handleSendEmote = async (emoteId: string) => {
    if (!user) return
    const emote = EMOTE_BY_ID[emoteId]
    if (!emote) return

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg = {
      _id: optimisticId,
      _creationTime: Date.now(),
      user: user.id,
      userId: user.id,
      userName: displayName,
      avatarUrl: resolvedAvatar,
      body: `:emote:${emote.id}`,
    }

    setOptimisticMessages((prev) => [...prev, optimisticMsg])
    setIsEmotePickerOpen(false)

    try {
      await sendMessage({
        user: user.id,
        userId: user.id,
        userName: displayName,
        avatarUrl: resolvedAvatar,
        body: `:emote:${emote.id}`,
      })
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    } catch (error) {
      console.error("Failed to send emote:", error)
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    }
  }

  const renderMessageBody = (body: string) => {
    const parts = body.split(/(@\w+)/g)
    return parts.map((part, index) =>
      part.startsWith("@") ? (
        <span key={`mention-${index}`} className="text-[#c4ff0e] font-semibold">
          {part}
        </span>
      ) : (
        <span key={`text-${index}`}>{part}</span>
      )
    )
  }

  const updateMentionState = (value: string) => {
    const mentionMatch = value.match(/@([\w.-]*)$/)
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1])
      setShowMentionPopup(true)
      setMentionPosition(value.lastIndexOf("@"))
    } else {
      setShowMentionPopup(false)
      setMentionSearch("")
      setMentionPosition(null)
    }
  }

  const insertMention = (alias: string) => {
    const updated =
      mentionPosition !== null
        ? `${newMessage.slice(0, mentionPosition)}@${alias} `
        : newMessage.replace(/@(\w*)$/, `@${alias} `)
    setNewMessage(updated)
    setShowMentionPopup(false)
    setMentionSearch("")
    setMentionPosition(null)
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
    setShowMentionPopup(false)
    setMentionSearch("")
    setMentionPosition(null)
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

  useEffect(() => {
    if (!user || convexUser || hasSyncedUserRef.current) return
    hasSyncedUserRef.current = true
    const fallbackAlias = user.username || user.firstName || "User"
    upsertUser({
      clerkId: user.id,
      alias: fallbackAlias,
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    }).catch((error) => {
      console.error("Failed to sync user profile:", error)
    })
  }, [user, convexUser, upsertUser])

  useEffect(() => {
    if (status !== "CanLoadMore") return
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore(30)
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [status, loadMore])

  return (
    <div className="flex flex-col touch-pan-y">
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

      {isSignedIn ? (
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
          <button
            type="button"
            onClick={() => setIsEmotePickerOpen((prev) => !prev)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-300 transition-colors hover:text-white hover:border-[#c4ff0e]"
            title="Emotes"
          >
            <Smile className="h-5 w-5" />
          </button>
          <div className="flex-1 flex flex-col gap-2">
            <div className="relative">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  updateMentionState(e.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowMentionPopup(false)
                  }
                }}
                onPaste={handlePaste}
                placeholder="Type a message or paste an image..."
                className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#c4ff0e] border border-zinc-800 min-h-[44px] resize-none"
                rows={2}
              />
              {showMentionPopup && (
                <div className="absolute left-0 top-full z-20 mt-2 w-full max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl">
                  {mentionResults === undefined && (
                    <div className="px-2 py-2 text-xs text-zinc-400">Loading matches…</div>
                  )}
                  {mentionResults && mentionResults.length === 0 && (
                    <div className="px-2 py-2 text-xs text-zinc-400">No matches found</div>
                  )}
                  {mentionResults?.map((mention) => (
                    <button
                      key={mention._id}
                      type="button"
                      onClick={() => insertMention(mention.alias)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white hover:bg-zinc-800/80"
                    >
                      <div className="h-7 w-7 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
                        {mention.selectedAvatar || mention.imageUrl ? (
                          <img
                            src={mention.selectedAvatar || mention.imageUrl}
                            alt={mention.alias}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-zinc-300">
                            {mention.alias.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="font-medium">{mention.alias}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isEmotePickerOpen && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                {EMOTES.map((emote) => (
                  <button
                    key={emote.id}
                    type="button"
                    onClick={() => handleSendEmote(emote.id)}
                    className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 transition-all hover:-translate-y-0.5 hover:border-[#c4ff0e] hover:bg-zinc-900/80"
                    aria-label={`Send ${emote.alt}`}
                  >
                    <img
                      src={emote.src}
                      alt={emote.alt}
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
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
      ) : (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Sign in to join the chat and post messages.</span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full sm:w-auto rounded-lg bg-[#c4ff0e] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#b3e60d]"
              >
                Sign in to chat
              </button>
            </SignInButton>
          </div>
        </div>
      )}

      <div className="space-y-3 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 touch-pan-y">
        {[...optimisticMessages, ...(messages || [])]
          .filter((message) => !deletedMessageIds.has(message._id))
          .sort((a, b) => b._creationTime - a._creationTime)
          .map((message) => {
            const rawBody = message.body ?? ""
            const emoteMatch = rawBody.match(/^:emote:([^\s]+)$/)
            const emote = emoteMatch ? EMOTE_BY_ID[emoteMatch[1]] : undefined
            const { text, urls: gifUrls } = emote ? { text: "", urls: [] } : extractGifUrls(rawBody)
            const isGifUpload =
              message.imageMimeType === "image/gif" ||
              message.imageUrl?.toLowerCase().includes(".gif")
            const isOptimistic = typeof message._id === "string" && message._id.startsWith("optimistic-")
            const loveCount = message.loveCount ?? 0
            const recentLovers = message.recentLovers ?? []

            return (
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
                  {emote && (
                    <div className="mt-2">
                      <img
                        src={emote.src}
                        alt={emote.alt}
                        className="max-h-80 max-w-[280px] rounded-lg object-contain shadow-lg"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {text.length > 0 && (
                    <p className="text-sm text-white break-words">
                      {renderMessageBody(text)}
                    </p>
                  )}
                  {gifUrls.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      {gifUrls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt="Shared GIF"
                          loading="lazy"
                          className="max-h-80 max-w-[280px] rounded-lg object-contain shadow-lg"
                        />
                      ))}
                    </div>
                  )}
                  {message.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={message.imageUrl}
                        alt="Shared in chat"
                        loading="lazy"
                        className={`max-h-80 max-w-[280px] rounded-lg shadow-lg ${
                          isGifUpload ? "object-contain" : "object-cover"
                        }`}
                      />
                    </div>
                  )}
                  {!isOptimistic && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <button
                        onClick={() => handleLove(message._id)}
                        className={`flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                          loveCount > 0 || loveAnimatingId === message._id
                            ? "bg-red-600 text-white"
                            : "bg-zinc-900/60 text-zinc-500 hover:text-red-500"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${loveCount > 0 ? "fill-white" : ""}`} />
                        <span>{loveCount}</span>
                      </button>
                      {recentLovers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {recentLovers.map((lover: { clerkId: string; alias: string; avatarUrl?: string }) => (
                            <div
                              key={`${message._id}-${lover.clerkId}`}
                              className="h-5 w-5 rounded-full border border-zinc-900 bg-zinc-800 flex items-center justify-center overflow-hidden text-[10px]"
                              title={lover.alias}
                            >
                              {lover.avatarUrl ? (
                                <img src={lover.avatarUrl} alt={lover.alias} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-white">{lover.alias.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        <div ref={loadMoreRef} className="py-4 text-center text-xs text-zinc-500">
          {status === "LoadingMore" && "Loading more messages..."}
          {status === "CanLoadMore" && "Scroll for more messages"}
          {status === "Exhausted" && "You're all caught up"}
        </div>
      </div>

    </div>
  )
}
