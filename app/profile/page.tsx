"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Users, UserPlus, Heart, Music, Loader2 } from "lucide-react";
import MainNav from "@/components/navigation/MainNav";
import EditableAlias from "../../components/ui/editable-alias";
import { CrateSection } from "@/components/bidding";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [alias, setAlias] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const upsertUser = useMutation(api.users.upsertUser);
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const updateAvatar = useMutation(api.users.updateSelectedAvatar);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const followers = useQuery(
    api.users.getFollowers,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const following = useQuery(
    api.users.getFollowing,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const followerCount = useQuery(
    api.users.getFollowerCount,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const followingCount = useQuery(
    api.users.getFollowingCount,
    user?.id ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    if (!user) {
      console.info("[profile] user not loaded; skipping alias sync");
      return;
    }

    if (convexUser) {
      setAlias((prevAlias) => {
        if (prevAlias === convexUser.alias) {
          return prevAlias;
        }

        console.info("[profile] syncing alias from Convex", {
          previousAlias: prevAlias,
          nextAlias: convexUser.alias,
        });
        return convexUser.alias;
      });
      return;
    }

    setAlias((prevAlias) => {
      if (prevAlias) {
        return prevAlias;
      }

      const fallbackAlias = user.username || user.firstName || "User";
      console.info("[profile] defaulting alias from Clerk", { fallbackAlias });
      return fallbackAlias;
    });
  }, [convexUser, user]);

  const handleAliasSubmit = async (newAlias: string) => {
    if (!user || !newAlias.trim()) return;

    const trimmedAlias = newAlias.trim();
    console.info("[profile] submitting alias", {
      trimmedAlias,
      previousAlias: convexUser?.alias,
    });
    try {
      await upsertUser({
        alias: trimmedAlias,
        email: user.primaryEmailAddress?.emailAddress,
        imageUrl: user.imageUrl,
      });
      setAlias(trimmedAlias);
      console.info("[profile] alias mutation completed", { trimmedAlias });
    } catch (error) {
      console.error("[profile] failed to update alias", error);
      alert("Failed to update alias. Please try again.");
    }
  };

  const currentAvatar = convexUser?.selectedAvatar || user?.imageUrl || "";
  useEffect(() => {
    if (convexUser?.selectedAvatar) {
      setAvatarPreview(convexUser.selectedAvatar);
    } else if (user?.imageUrl) {
      setAvatarPreview(user.imageUrl);
    }
  }, [convexUser?.selectedAvatar, user?.imageUrl]);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_IMAGE_SIZE) {
      alert("Image is too large. Please choose a file under 8MB.");
      return;
    }

    setIsUploadingAvatar(true);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const { uploadUrl } = await generateAvatarUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      const { storageId } = await uploadRes.json();
      const result = await updateAvatar({
        avatarStorageId: storageId,
      });
      if (result?.imageUrl) {
        setAvatarPreview(result.imageUrl);
      }
    } catch (error) {
      console.error("[profile] avatar upload failed", error);
      alert("Failed to upload avatar. Please try again.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav />

      {/* Header with gradient */}
      <div className="relative bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 h-48 mt-16">
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-16 sm:-mt-20">
        {/* Profile Card */}
        <div className="bg-zinc-900 rounded-3xl p-6 sm:p-8 mb-6 border border-zinc-800">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
            <div className="relative flex-shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative"
                aria-label="Upload new avatar"
              >
                <img
                  src={avatarPreview || currentAvatar || "/placeholder.svg"}
                  alt={alias}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-lime-400 shadow-xl object-cover"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-lime-300 animate-spin" />
                  ) : (
                    <span className="text-xs text-lime-200 font-semibold">Change</span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-lime-400 rounded-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-black" />
                </div>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 w-full rounded-lg border border-lime-400/40 bg-black/40 px-3 py-2 text-xs font-semibold text-lime-200 hover:bg-lime-400/10 transition"
              >
                {isUploadingAvatar ? "Uploading..." : "Upload photo"}
              </button>
            </div>
            <div className="flex-1 text-center sm:text-left w-full">
              <div className="mb-4">
                <EditableAlias
                  key={`top-${alias}`}
                  value={alias || user.username || user.firstName || "User"}
                  onSubmit={handleAliasSubmit}
                  placeholder="Enter your alias..."
                />
              </div>
              <p className="text-sm text-zinc-400 mb-6">
                {user.primaryEmailAddress?.emailAddress}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full">
                  <Users className="w-4 h-4 text-lime-400" />
                  <span className="font-semibold text-lime-400">
                    {followerCount || 0}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {followerCount === 1 ? "Follower" : "Followers"}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full">
                  <UserPlus className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-cyan-400">
                    {followingCount || 0}
                  </span>
                  <span className="text-sm text-zinc-400">Following</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-zinc-900 rounded-2xl p-6 mb-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-lime-400/10 rounded-full flex items-center justify-center">
              <Music className="w-5 h-5 text-lime-400" />
            </div>
            <h2 className="text-xl font-bold">Profile Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Alias / Stage Name
              </label>
              <EditableAlias
                key={`settings-${alias}`}
                value={alias || user.username || user.firstName || "User"}
                onSubmit={handleAliasSubmit}
                placeholder="Enter your alias..."
              />
              <p className="text-xs text-zinc-500 mt-2">
                Your alias is displayed in chat and public listings
              </p>
            </div>
          </div>
        </div>

        {/* Crate Section - Temporarily disabled for debugging
        <div className="mb-6">
          <CrateSection />
        </div>
        */}

        {/* Tabs-style sections */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Followers Section */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-lime-400/10 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-lime-400" />
              </div>
              <h2 className="text-xl font-bold">
                Followers ({followers?.length || 0})
              </h2>
            </div>

            {!followers || followers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500">No followers yet</p>
                <p className="text-sm text-zinc-600 mt-2">
                  Share your profile to get followers!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {followers.map((follower) => (
                  <div
                    key={follower._id}
                    className="flex items-center gap-4 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-800/60 transition-colors"
                  >
                    {follower.imageUrl && (
                      <img
                        src={follower.imageUrl}
                        alt={follower.alias}
                        className="w-12 h-12 rounded-full border-2 border-lime-400/20"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-lime-400">
                        {follower.alias}
                      </p>
                      {follower.email && (
                        <p className="text-xs text-zinc-500">{follower.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Following Section */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-cyan-400/10 rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold">
                Following ({following?.length || 0})
              </h2>
            </div>

            {!following || following.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500">Not following anyone yet</p>
                <p className="text-sm text-zinc-600 mt-2">
                  Discover artists to follow!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {following.map((followedUser) => (
                  <div
                    key={followedUser._id}
                    className="flex items-center gap-4 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-800/60 transition-colors"
                  >
                    {followedUser.imageUrl ? (
                      <img
                        src={followedUser.imageUrl}
                        alt={followedUser.alias}
                        className="w-12 h-12 rounded-full border-2 border-cyan-400/20"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-xl font-bold">
                        {followedUser.alias[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-cyan-400">
                        {followedUser.alias}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
