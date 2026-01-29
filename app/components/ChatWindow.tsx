"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Image as ImageIcon, Loader2, MessageSquare, Send } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function ChatWindow() {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messages = useQuery(api.chat.getMessages);
  const sendMessage = useMutation(api.chat.sendMessage);
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl);

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || isSending) return;

    try {
      setIsSending(true);
      let uploadedStorageId: Id<"_storage"> | undefined;
      let uploadedMimeType: string | undefined;

      if (imageFile) {
        const mimeType =
          imageFile.type ||
          (imageFile.name?.toLowerCase().endsWith(".gif") ? "image/gif" : "application/octet-stream");
        uploadedMimeType = mimeType;
        const { uploadUrl } = await generateUploadUrl({});
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: imageFile,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { storageId } = await uploadRes.json();
        uploadedStorageId = storageId;
      }

      await sendMessage({
        body: newMessage.trim(),
        imageStorageId: uploadedStorageId,
        imageMimeType: uploadedMimeType || imageFile?.type,
      });
      setNewMessage("");
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      setImageFile(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelection = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_IMAGE_SIZE) {
      alert("Image is too large. Please choose a file under 8MB.");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageSelection(file);
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const fileItem = Array.from(event.clipboardData?.items || []).find((item) =>
      item.type.startsWith("image/")
    );
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) {
        event.preventDefault();
        handleImageSelection(file);
      }
    }
  };

  return (
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/70 text-zinc-300 transition-colors hover:text-white"
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
            className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400 border border-white/10 min-h-[44px] resize-none"
            rows={2}
          />
          {imagePreview && (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3">
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
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                    setImageFile(null);
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-black transition-colors hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed sm:h-auto sm:min-w-[120px] sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
              {message.body && message.body.trim().length > 0 && (
                <p className="text-sm text-white break-words">{message.body}</p>
              )}
              {message.imageUrl && (
                <div className="mt-2 max-w-full">
                  <img
                    src={message.imageUrl}
                    alt="Shared in chat"
                    loading="lazy"
                    className="max-h-64 w-full max-w-md rounded-xl border border-white/10 object-contain bg-black/40"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
