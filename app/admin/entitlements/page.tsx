"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MainNav from "@/components/navigation/MainNav";
import {
  Search,
  Trash2,
  Video,
  Radio,
  Plus,
  CheckCircle,
  XCircle,
  Link2,
} from "lucide-react";

export default function EntitlementsAdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // UI State
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [contentType, setContentType] = useState<"video" | "livestream">("video");
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);

  // Bundled entitlement test state
  const [testUserId, setTestUserId] = useState("");
  const [testVideoId, setTestVideoId] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Admin check
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Data queries
  const entitlements = useQuery(
    api.entitlements.getAllEntitlements,
    isAdmin && user?.id ? { clerkId: user.id } : "skip"
  );

  const searchResults = useQuery(
    api.adminSettings.searchUsersForAdmin,
    isAdmin && user?.id && userSearchTerm.trim().length > 0
      ? { clerkId: user.id, searchTerm: userSearchTerm }
      : "skip"
  );

  const videos = useQuery(
    api.entitlements.getAllVideosForAdmin,
    isAdmin && user?.id ? { clerkId: user.id, limit: 100 } : "skip"
  );

  const livestreams = useQuery(
    api.entitlements.getAllLivestreamsForAdmin,
    isAdmin && user?.id ? { clerkId: user.id, limit: 100 } : "skip"
  );

  // Test bundled entitlement
  const bundledEntitlementResult = useQuery(
    api.entitlements.hasBundledEntitlement,
    testUserId && testVideoId
      ? { userId: testUserId, videoId: testVideoId as Id<"videos"> }
      : "skip"
  );

  // Mutations
  const grantEntitlement = useMutation(api.entitlements.adminGrantEntitlement);
  const revokeEntitlement = useMutation(api.entitlements.adminRevokeEntitlement);

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  // Update test result when query result changes
  useEffect(() => {
    if (bundledEntitlementResult !== undefined) {
      setTestResult(bundledEntitlementResult);
    }
  }, [bundledEntitlementResult]);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSelectUser = (clerkId: string, alias: string) => {
    setSelectedUserId(clerkId);
    setSelectedUserName(alias);
    setUserSearchTerm("");
  };

  const handleGrantEntitlement = async () => {
    if (!user?.id || !selectedUserId || !selectedContentId) return;

    setIsGranting(true);
    try {
      await grantEntitlement({
        clerkId: user.id,
        targetUserId: selectedUserId,
        ...(contentType === "video"
          ? { videoId: selectedContentId as Id<"videos"> }
          : { livestreamId: selectedContentId as Id<"livestreams"> }),
      });
      showNotification("Entitlement granted successfully", "success");
      // Reset form
      setSelectedUserId(null);
      setSelectedUserName("");
      setSelectedContentId(null);
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to grant entitlement",
        "error"
      );
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeEntitlement = async (entitlementId: Id<"entitlements">) => {
    if (!user?.id) return;

    setIsRevoking(entitlementId);
    try {
      await revokeEntitlement({
        clerkId: user.id,
        entitlementId,
      });
      showNotification("Entitlement revoked", "success");
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to revoke entitlement",
        "error"
      );
    } finally {
      setIsRevoking(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-zinc-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const contentList = contentType === "video" ? videos : livestreams;

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div
            className={`px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-lime-400 text-black"
                : "bg-red-500 text-white"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {notification.message}
          </div>
        </div>
      )}

      <main className="pt-32 px-4 lg:px-8 max-w-6xl mx-auto pb-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Entitlements Dashboard</h1>
          <p className="text-zinc-400">
            Manage PPV access and test bundled entitlements
          </p>
        </div>

        <div className="grid gap-6">
          {/* Grant Entitlement Section */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-lime-400" />
              Grant Entitlement
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  1. Select User
                </label>
                {selectedUserId ? (
                  <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="font-medium">{selectedUserName}</span>
                    <button
                      onClick={() => {
                        setSelectedUserId(null);
                        setSelectedUserName("");
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Search by alias or email"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white focus:border-lime-400 focus:outline-none"
                    />
                    {searchResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {searchResults.map((result) => (
                          <button
                            key={result.clerkId}
                            onClick={() =>
                              handleSelectUser(result.clerkId, result.alias)
                            }
                            className="w-full text-left px-4 py-2 hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg"
                          >
                            <p className="font-medium">{result.alias}</p>
                            <p className="text-xs text-zinc-500">
                              {result.email || "No email"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Content Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  2. Select Content
                </label>

                {/* Type Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      setContentType("video");
                      setSelectedContentId(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      contentType === "video"
                        ? "bg-lime-400 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    Video
                  </button>
                  <button
                    onClick={() => {
                      setContentType("livestream");
                      setSelectedContentId(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      contentType === "livestream"
                        ? "bg-lime-400 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    Livestream
                  </button>
                </div>

                <select
                  value={selectedContentId || ""}
                  onChange={(e) => setSelectedContentId(e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 px-4 text-sm text-white focus:border-lime-400 focus:outline-none"
                >
                  <option value="">Select {contentType}...</option>
                  {contentList?.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                      {item.visibility === "ppv" && item.price
                        ? ` ($${(item.price / 100).toFixed(2)})`
                        : ""}
                      {"linkedLivestreamId" in item && item.linkedLivestreamId
                        ? " [Has linked livestream]"
                        : ""}
                      {"recordingVideoId" in item && item.recordingVideoId
                        ? " [Has recording]"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGrantEntitlement}
              disabled={!selectedUserId || !selectedContentId || isGranting}
              className="mt-6 flex items-center gap-2 bg-lime-400 text-black px-6 py-3 rounded-full font-semibold hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {isGranting ? "Granting..." : "Grant Entitlement"}
            </button>
          </section>

          {/* Test Bundled Entitlement Section */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-400" />
              Test Bundled Entitlement
            </h2>
            <p className="text-sm text-zinc-500 mb-4">
              Test if a user has access to a video through bundled entitlements
              (e.g., owning the linked livestream).
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  User ID (Clerk ID)
                </label>
                <input
                  value={testUserId}
                  onChange={(e) => {
                    setTestUserId(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="user_abc123..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Video ID
                </label>
                <select
                  value={testVideoId}
                  onChange={(e) => {
                    setTestVideoId(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Select video...</option>
                  {videos?.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.title}
                      {v.linkedLivestreamId ? " [Linked to livestream]" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div
                  className={`w-full py-3 px-4 rounded-lg text-center font-medium ${
                    testResult === null
                      ? "bg-zinc-800 text-zinc-500"
                      : testResult
                      ? "bg-green-900/50 text-green-400 border border-green-700"
                      : "bg-red-900/50 text-red-400 border border-red-700"
                  }`}
                >
                  {testResult === null
                    ? "Select user & video"
                    : testResult
                    ? "Has Access"
                    : "No Access"}
                </div>
              </div>
            </div>
          </section>

          {/* Current Entitlements Section */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">
              Current Entitlements ({entitlements?.length || 0})
            </h2>

            {!entitlements || entitlements.length === 0 ? (
              <p className="text-sm text-zinc-500">No entitlements found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Content</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Granted</th>
                      <th className="pb-3 font-medium">By</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {entitlements.map((ent) => (
                      <tr key={ent._id} className="text-zinc-300">
                        <td className="py-3">
                          <div>
                            <p className="font-medium">{ent.userName}</p>
                            <p className="text-xs text-zinc-500">
                              {ent.userEmail || ent.userId}
                            </p>
                          </div>
                        </td>
                        <td className="py-3">{ent.contentTitle}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              ent.contentType === "video"
                                ? "bg-purple-900/50 text-purple-300"
                                : "bg-blue-900/50 text-blue-300"
                            }`}
                          >
                            {ent.contentType === "video" ? (
                              <Video className="w-3 h-3" />
                            ) : (
                              <Radio className="w-3 h-3" />
                            )}
                            {ent.contentType}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-500">
                          {formatDate(ent.grantedAt)}
                        </td>
                        <td className="py-3 text-zinc-500">
                          {ent.grantedBy === "purchase"
                            ? "Purchase"
                            : ent.grantedBy.startsWith("user_")
                            ? "Admin"
                            : ent.grantedBy}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleRevokeEntitlement(ent._id)}
                            disabled={isRevoking === ent._id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                            title="Revoke entitlement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
