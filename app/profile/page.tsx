"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Users, UserPlus, Heart, Music } from "lucide-react";
import Header from "../components/Header";
import EditableAlias from "../../components/ui/editable-alias";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [alias, setAlias] = useState("");

  const upsertUser = useMutation(api.users.upsertUser);
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
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
    console.log("useEffect triggered - convexUser:", convexUser, "user:", user?.username, "current alias:", alias);
    if (convexUser) {
      console.log("Setting alias from convexUser:", convexUser.alias);
      setAlias(convexUser.alias);
    } else if (user && !alias) {
      console.log("Setting alias from user:", user.username || user.firstName || "User");
      setAlias(user.username || user.firstName || "User");
    }
  }, [convexUser, user, alias]);

  const handleAliasSubmit = async (newAlias: string) => {
    if (!user || !newAlias.trim()) return;

    console.log("Submitting alias:", newAlias);
    try {
      await upsertUser({
        clerkId: user.id,
        alias: newAlias.trim(),
        email: user.primaryEmailAddress?.emailAddress,
        imageUrl: user.imageUrl,
      });
      setAlias(newAlias.trim());
      console.log("Alias updated successfully");
    } catch (error) {
      console.error("Failed to update alias:", error);
      alert("Failed to update alias. Please try again.");
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
      <Header title="PROFILE" />

      {/* Header with gradient */}
      <div className="relative bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 h-48 mt-16">
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-20">
        {/* Profile Card */}
        <div className="bg-zinc-900 rounded-3xl p-8 mb-6 border border-zinc-800">
          <div className="flex items-start gap-6 mb-8">
            <div className="relative">
              <img
                src={user.imageUrl}
                alt={alias}
                className="w-32 h-32 rounded-full border-4 border-lime-400 shadow-xl"
              />
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-lime-400 rounded-full flex items-center justify-center">
                <Music className="w-5 h-5 text-black" />
              </div>
            </div>
            <div className="flex-1">
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
              <div className="flex gap-6">
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
