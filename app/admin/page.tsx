"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MainNav from "@/components/navigation/MainNav";
import Link from "next/link";
import { Search, ShieldCheck, ShieldOff, Disc3, Play, Square, Loader2, Clock, DollarSign, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBiddingUpdating, setIsBiddingUpdating] = useState(false);

  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? {} : "skip"
  );

  const admins = useQuery(
    api.adminSettings.getAdmins,
    isAdmin && user?.id ? {} : "skip"
  );

  const searchResults = useQuery(
    api.adminSettings.searchUsersForAdmin,
    isAdmin && user?.id && searchTerm.trim().length > 0
      ? { searchTerm }
      : "skip"
  );

  const setAdminStatus = useMutation(api.adminSettings.setAdminStatus);

  // Bidding controls
  const activeStream = useQuery(
    api.livestream.getActiveStream,
    isAdmin ? {} : "skip"
  );
  const currentBiddingSession = useQuery(
    api.bidding.getCurrentSession,
    isAdmin && activeStream?._id ? { livestreamId: activeStream._id } : "skip"
  );
  const openBidding = useMutation(api.bidding.openBidding);
  const closeBidding = useMutation(api.bidding.closeBidding);
  const allCratePurchases = useQuery(
    api.bidding.getAllCratePurchases,
    isAdmin ? {} : "skip"
  );

  const adminIds = useMemo(() => new Set(admins?.map((admin) => admin.clerkId)), [admins]);

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenBidding = async () => {
    if (!activeStream) return;
    setIsBiddingUpdating(true);
    try {
      const videoTimestamp = Math.floor((Date.now() - activeStream.startedAt) / 1000);
      await openBidding({ livestreamId: activeStream._id, videoTimestamp });
      showNotification("Bidding opened!");
    } catch (error) {
      console.error("Open bidding error:", error);
      alert(error instanceof Error ? error.message : "Failed to open bidding");
    } finally {
      setIsBiddingUpdating(false);
    }
  };

  const handleCloseBidding = async () => {
    if (!currentBiddingSession) return;
    setIsBiddingUpdating(true);
    try {
      await closeBidding({ sessionId: currentBiddingSession._id });
      showNotification("Bidding closed");
    } catch (error) {
      console.error("Close bidding error:", error);
      alert(error instanceof Error ? error.message : "Failed to close bidding");
    } finally {
      setIsBiddingUpdating(false);
    }
  };

  const handleAdminToggle = async (targetClerkId: string, nextIsAdmin: boolean) => {
    setIsUpdating(true);
    try {
      if (!user?.id) {
        throw new Error("Not authenticated");
      }
      await setAdminStatus({ targetClerkId, isAdmin: nextIsAdmin });
      showNotification(nextIsAdmin ? "Admin access granted" : "Admin access revoked");
    } catch (error) {
      console.error("Admin update error:", error);
      alert(error instanceof Error ? error.message : "Failed to update admin status");
    } finally {
      setIsUpdating(false);
    }
  };

  // Show loading state
  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-xl text-zinc-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-lime-400 text-black px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
            {notification}
          </div>
        </div>
      )}

      <main className="pt-32 px-4 lg:px-8 max-w-5xl mx-auto pb-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Settings</h1>
          <p className="text-zinc-400">Manage administrator access</p>
        </div>

        <div className="grid gap-6">
          {/* Bidding Controls */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Disc3 className="h-5 w-5 text-[#ff00ff]" />
              <h2 className="text-lg font-semibold">Track Crate Bidding</h2>
            </div>

            {!activeStream ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Disc3 className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-zinc-500">No active livestream</p>
                <p className="text-xs text-zinc-600 mt-1">Start a livestream to enable bidding controls</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stream info */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-medium">{activeStream.title}</span>
                  <span className="ml-auto text-xs text-zinc-500">LIVE</span>
                </div>

                {/* Current session status */}
                {currentBiddingSession ? (
                  <div className="px-4 py-3 rounded-lg bg-[#ff00ff]/10 border border-[#ff00ff]/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#ff00ff]">Bidding Active</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff00ff]/20 text-[#ff00ff]">
                        {currentBiddingSession.status}
                      </span>
                    </div>
                    {currentBiddingSession.holder && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-400">Holder:</span>
                        <span className="font-medium">{currentBiddingSession.holder.alias}</span>
                        <span className="text-[#c4ff0e]">
                          ${(currentBiddingSession.currentBid!.amount / 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {!currentBiddingSession.holder && (
                      <p className="text-sm text-zinc-400">Waiting for first bid...</p>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-lg bg-zinc-800/50 border border-dashed border-zinc-700">
                    <p className="text-sm text-zinc-400">No active bidding session</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  {!currentBiddingSession ? (
                    <button
                      onClick={handleOpenBidding}
                      disabled={isBiddingUpdating}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#c4ff0e] px-4 py-3 font-semibold text-black hover:bg-[#b3e60d] transition-colors disabled:opacity-50"
                    >
                      {isBiddingUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Open Bidding
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleCloseBidding}
                      disabled={isBiddingUpdating}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500/60 px-4 py-3 font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {isBiddingUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Square className="h-4 w-4" />
                          Close Bidding
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-zinc-500">
                  Bidding also auto-opens every 5 minutes during live streams.
                </p>
              </div>
            )}
          </section>

          {/* Crate Purchases */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Disc3 className="h-5 w-5 text-[#ff00ff]" />
              <h2 className="text-lg font-semibold">All Crate Purchases</h2>
              {allCratePurchases && allCratePurchases.length > 0 && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-[#ff00ff]/20 text-[#ff00ff]">
                  {allCratePurchases.length} total
                </span>
              )}
            </div>

            {!allCratePurchases || allCratePurchases.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Disc3 className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-zinc-500">No crate purchases yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allCratePurchases.map((item) => {
                  const purchaseDate = new Date(item.purchasedAt);
                  const dateFormatted = purchaseDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const timeFormatted = purchaseDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  });

                  return (
                    <div
                      key={item._id}
                      className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
                    >
                      {/* User avatar */}
                      <div className="flex-shrink-0">
                        {item.ownerAvatarUrl ? (
                          <img
                            src={item.ownerAvatarUrl}
                            alt={item.ownerAlias}
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#ff00ff]/40"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                            {item.ownerAlias[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* User and track info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white truncate">
                            {item.ownerAlias}
                          </h4>
                          {item.ownerEmail && (
                            <span className="text-xs text-zinc-500 truncate">
                              ({item.ownerEmail})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 truncate">
                          {item.livestreamTitle}
                        </p>
                      </div>

                      {/* Amount and status */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1 text-[#c4ff0e] font-bold">
                          <DollarSign className="w-4 h-4" />
                          {(item.purchaseAmount / 100).toFixed(0)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-right text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dateFormatted}
                        </div>
                        <div>{timeFormatted}</div>
                      </div>

                      {/* Link to watch at timestamp (conditional based on recording status) */}
                      {item.livestreamStatus === "active" ? (
                        <div
                          className="flex-shrink-0 rounded-lg bg-zinc-700/50 px-3 py-2 text-xs font-medium text-zinc-500 cursor-not-allowed"
                          title="Video will be available when livestream ends"
                        >
                          <Clock className="w-4 h-4" />
                        </div>
                      ) : item.recordingStatus === "processing" ? (
                        <div
                          className="flex-shrink-0 rounded-lg bg-zinc-700/50 px-3 py-2 text-xs font-medium text-zinc-500 cursor-not-allowed"
                          title="Recording is processing"
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : item.recordingVideoId && item.recordingStatus === "ready" ? (
                        <Link
                          href={`/watch/${item.recordingVideoId}?t=${item.videoTimestamp}`}
                          className="flex-shrink-0 rounded-lg bg-[#ff00ff]/10 px-3 py-2 text-xs font-medium text-[#ff00ff] hover:bg-[#ff00ff]/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      ) : (
                        <div
                          className="flex-shrink-0 rounded-lg bg-zinc-700/50 px-3 py-2 text-xs font-medium text-zinc-500 cursor-not-allowed"
                          title="Recording unavailable"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Current Admins</h2>
            {!admins || admins.length === 0 ? (
              <p className="text-sm text-zinc-500">No admins found.</p>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div key={admin.clerkId} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-800/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {admin.imageUrl ? (
                        <img
                          src={admin.imageUrl}
                          alt={admin.alias}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-semibold">
                          {(admin.alias || "A").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{admin.alias}</p>
                        <p className="text-xs text-zinc-500">{admin.email || "No email"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdminToggle(admin.clerkId, false)}
                      disabled={isUpdating}
                      className="flex items-center gap-2 rounded-full border border-red-500/60 px-4 py-2 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <ShieldOff className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Add or Remove Admins</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by alias or email"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white focus:border-lime-400 focus:outline-none"
              />
            </div>

            {!searchTerm.trim() ? (
              <p className="text-sm text-zinc-500">Search for a user to grant or revoke admin access.</p>
            ) : !searchResults || searchResults.length === 0 ? (
              <p className="text-sm text-zinc-500">No users found.</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => {
                  const currentlyAdmin = adminIds.has(result.clerkId);
                  return (
                    <div key={result.clerkId} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-800/70 px-4 py-3">
                      <div className="flex items-center gap-3">
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.alias}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-semibold">
                            {(result.alias || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{result.alias}</p>
                          <p className="text-xs text-zinc-500">{result.email || "No email"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAdminToggle(result.clerkId, !currentlyAdmin)}
                        disabled={isUpdating}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          currentlyAdmin
                            ? "border-red-500/60 text-red-400 hover:border-red-400 hover:text-red-300"
                            : "border-lime-400/60 text-lime-300 hover:border-lime-300 hover:text-lime-200"
                        }`}
                      >
                        {currentlyAdmin ? (
                          <>
                            <ShieldOff className="h-4 w-4" />
                            Remove
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Make Admin
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
