"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Gavel, Timer, CreditCard, Loader2, Plus, Square } from "lucide-react";

interface AuctionPanelProps {
  livestreamId: Id<"livestreams">;
  streamStartedAt?: number;
}

export function AuctionPanel({ livestreamId, streamStartedAt }: AuctionPanelProps) {
  const { user, isLoaded } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const session = useQuery(api.bidding.getCurrentSession, { livestreamId });
  const currentUser = useQuery(
    api.users.getCurrentUser,
    user?.id ? {} : "skip"
  );
  const placeBid = useMutation(api.bidding.placeBid);
  const openBidding = useMutation(api.bidding.openBidding);
  const closeBidding = useMutation(api.bidding.closeBidding);
  const processBiddingExpiry = useMutation(api.bidding.processBiddingExpiry);

  const isAdmin = currentUser?.isAdmin ?? false;

  // Update countdown timer and process expiry when it hits 0
  useEffect(() => {
    if (!session) return;

    const updateCountdown = async () => {
      if (session.status === "open" && session.biddingEndsAt) {
        const remaining = Math.max(0, session.biddingEndsAt - Date.now());
        const seconds = Math.ceil(remaining / 1000);
        setCountdown(seconds);

        // When countdown hits 0, trigger the expiry processing
        if (seconds === 0 && session.holder) {
          try {
            await processBiddingExpiry({ sessionId: session._id });
          } catch (err) {
            // Silently handle - cron will also process this
            console.error("Failed to process bidding expiry:", err);
          }
        }
      } else {
        setCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session, processBiddingExpiry]);

  const handleOpenBidding = async () => {
    if (!streamStartedAt) return;
    setIsLoading(true);
    setError(null);
    try {
      const videoTimestamp = Math.floor((Date.now() - streamStartedAt) / 1000);
      await openBidding({ livestreamId, videoTimestamp });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open bidding");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseBidding = async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    try {
      await closeBidding({ sessionId: session._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close bidding");
    } finally {
      setIsLoading(false);
    }
  };

  // Show "Open Bidding" button for admins when no session exists
  if (!session) {
    if (!isAdmin) return null;

    return (
      <div className="mb-4 rounded-xl border border-[#ff00ff]/30 bg-gradient-to-r from-[#ff00ff]/10 via-zinc-900/80 to-[#c4ff0e]/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff00ff] text-white">
              <Gavel className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-white">Live Auction - BUY THIS RECORD NOW</span>
          </div>
          <button
            onClick={handleOpenBidding}
            disabled={isLoading || !streamStartedAt}
            className="flex items-center gap-2 rounded-lg bg-[#c4ff0e] px-4 py-2 text-sm font-bold text-black transition-all hover:bg-[#b3e60d] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Open Bidding
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-center text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }

  const isHolder = session.holder?.clerkId === user?.id;
  const isWinner = session.status === "payment_pending" && isHolder;

  const handlePlaceBid = async () => {
    if (!session || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      await placeBid({ sessionId: session._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bidding/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session._id,
          livestreamId: session.livestreamId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-[#ff00ff]/30 bg-gradient-to-r from-[#ff00ff]/10 via-zinc-900/80 to-[#c4ff0e]/10 p-3">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff00ff] text-white">
            <Gavel className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-medium text-white">Live Auction - BUY THIS RECORD NOW</span>
            {session.status === "payment_pending" && (
              <div className="flex items-center gap-1 text-xs text-[#c4ff0e]">
                <CreditCard className="h-3 w-3" />
                <span>{isWinner ? "Ready to pay" : "Awaiting payment"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Bid Display */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-zinc-400">
              {session.holder ? "Current Bid" : "Starting Bid"}
            </div>
            <div className="text-xl font-bold text-[#c4ff0e]">
              ${(session.holder ? session.currentBid!.amount : 1000) / 100}
            </div>
          </div>
          {/* Admin Close Bidding Button - only show when bidding is still open */}
          {isAdmin && session.status === "open" && (
            <button
              onClick={handleCloseBidding}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-600 disabled:opacity-50"
            >
              {isLoading ? (
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
      </div>

      {/* Countdown Timer Bar - only show when countdown is active */}
      {session.holder && countdown !== null && countdown > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Timer className="h-3 w-3" />
              <span>Time remaining</span>
            </div>
            <span className={`text-sm font-bold ${countdown <= 10 ? "text-red-400 animate-pulse" : "text-white"}`}>
              {countdown}s
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                countdown <= 10 ? "bg-red-500" : countdown <= 30 ? "bg-orange-500" : "bg-[#c4ff0e]"
              }`}
              style={{ width: `${(countdown / 60) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Holder Info */}
      {session.holder && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-zinc-800/50 rounded-lg">
          <div className="h-6 w-6 overflow-hidden rounded-full border border-[#ff00ff]">
            {session.holder.avatarUrl ? (
              <img
                src={session.holder.avatarUrl}
                alt={session.holder.alias}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500 to-purple-500 text-xs font-bold">
                {session.holder.alias.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-sm text-zinc-300">
            <span className="text-[#ff00ff] font-medium">{session.holder.alias}</span>
            {isHolder ? " (You)" : ""} {session.status === "payment_pending" ? "won!" : "is winning"}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!isLoaded ? (
          <div className="flex-1 rounded-lg bg-zinc-800 py-2 text-center text-sm text-zinc-500">
            Loading...
          </div>
        ) : !user ? (
          <SignInButton mode="modal">
            <button className="flex-1 rounded-lg bg-[#c4ff0e] py-2 text-sm font-bold text-black transition-all hover:bg-[#b3e60d]">
              Sign in to Bid
            </button>
          </SignInButton>
        ) : (
          <>
            {/* Open state - no holder yet */}
            {session.status === "open" && !session.holder && (
              <button
                onClick={handlePlaceBid}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#c4ff0e] py-2 text-sm font-bold text-black transition-all hover:bg-[#b3e60d] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Bid $10 for this record</>
                )}
              </button>
            )}

            {/* Open state - someone else is holding, can outbid */}
            {session.status === "open" && session.holder && !isHolder && (
              <button
                onClick={handlePlaceBid}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#ff00ff] py-2 text-sm font-bold text-white transition-all hover:bg-[#e600e6] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Outbid ${session.nextBidAmount / 100}</>
                )}
              </button>
            )}

            {/* Open state - user is holder, waiting for countdown */}
            {session.status === "open" && isHolder && (
              <div className="flex-1 rounded-lg bg-gradient-to-r from-[#c4ff0e]/20 to-[#ff00ff]/20 py-2 text-center text-sm text-white">
                You're winning! {countdown !== null && `${countdown}s left`}
              </div>
            )}

            {/* Payment pending - winner can pay */}
            {session.status === "payment_pending" && isWinner && (
              <button
                onClick={handlePayNow}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#c4ff0e] py-2 text-sm font-bold text-black transition-all hover:bg-[#b3e60d] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay ${session.currentBid!.amount / 100}
                  </>
                )}
              </button>
            )}

            {/* Payment pending - non-winner */}
            {session.status === "payment_pending" && !isWinner && (
              <div className="flex-1 rounded-lg bg-zinc-800 py-2 text-center text-sm text-zinc-400">
                Awaiting payment...
              </div>
            )}
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <p className="mt-2 rounded-lg bg-red-600/20 px-3 py-1.5 text-center text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
