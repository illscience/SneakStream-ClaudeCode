"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Disc3, Timer, CreditCard, Loader2 } from "lucide-react";

interface BidSession {
  _id: Id<"biddingSessions">;
  livestreamId: Id<"livestreams">;
  videoTimestamp: number;
  openedAt: number;
  status: string;
  biddingEndsAt?: number;
  paymentDeadline?: number;
  currentBid: {
    amount: number;
    bidderId: string;
  } | null;
  holder: {
    clerkId: string;
    alias: string;
    avatarUrl?: string;
  } | null;
  nextBidAmount: number;
}

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  livestreamId: Id<"livestreams">;
  session: BidSession | null;
}

export function BidModal({ isOpen, onClose, livestreamId, session }: BidModalProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const placeBid = useMutation(api.bidding.placeBid);

  // Update countdown timer
  useEffect(() => {
    if (!session) return;

    const updateCountdown = () => {
      if (session.status === "open" && session.biddingEndsAt) {
        const remaining = Math.max(0, session.biddingEndsAt - Date.now());
        setCountdown(Math.ceil(remaining / 1000));
      } else if (session.status === "payment_pending" && session.paymentDeadline) {
        const remaining = Math.max(0, session.paymentDeadline - Date.now());
        setCountdown(Math.ceil(remaining / 1000));
      } else {
        setCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  const isHolder = session.holder?.clerkId === user?.id;
  const isWinner = session.status === "payment_pending" && isHolder;

  const handlePlaceBid = async () => {
    if (!session) return;

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
        headers: {
          "Content-Type": "application/json",
        },
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

  const formatCountdown = (seconds: number) => {
    return `${seconds}s`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Disc3 className="h-6 w-6 text-[#c4ff0e]" />
            Add to Crate
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Claim this track moment for your collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Holder Display */}
          {session.holder ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#ff00ff]">
                  {session.holder.avatarUrl ? (
                    <img
                      src={session.holder.avatarUrl}
                      alt={session.holder.alias}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500 to-purple-500 text-lg font-bold">
                      {session.holder.alias.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-400">Current holder</p>
                  <p className="font-bold text-[#ff00ff]">{session.holder.alias}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Holding at</p>
                  <p className="text-xl font-bold text-[#c4ff0e]">
                    ${(session.currentBid!.amount / 100).toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Countdown status */}
              {session.status === "open" && countdown !== null && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-orange-600/20 px-4 py-3">
                  <Timer className="h-5 w-5 text-orange-500" />
                  <span className={`text-lg font-bold ${countdown <= 10 ? "animate-pulse text-red-500" : "text-white"}`}>
                    {formatCountdown(countdown)}
                  </span>
                  <span className="text-sm text-zinc-400">to outbid</span>
                </div>
              )}

              {session.status === "payment_pending" && countdown !== null && isWinner && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#c4ff0e]/20 px-4 py-3">
                  <CreditCard className="h-5 w-5 text-[#c4ff0e]" />
                  <span className={`text-lg font-bold ${countdown <= 10 ? "animate-pulse text-red-500" : "text-[#c4ff0e]"}`}>
                    {formatCountdown(countdown)}
                  </span>
                  <span className="text-sm text-zinc-400">to complete payment</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-800/30 p-6 text-center">
              <Disc3 className="mx-auto mb-2 h-10 w-10 text-zinc-600" />
              <p className="text-zinc-400">No bids yet</p>
              <p className="text-sm text-zinc-500">Be the first to claim this track!</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {session.status === "open" && !session.holder && (
              <Button
                onClick={handlePlaceBid}
                disabled={isLoading}
                className="w-full bg-[#c4ff0e] py-6 text-lg font-bold text-black hover:bg-[#b3e60d]"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>Claim for $10</>
                )}
              </Button>
            )}

            {session.status === "open" && session.holder && !isHolder && (
              <Button
                onClick={handlePlaceBid}
                disabled={isLoading}
                className="w-full bg-[#ff00ff] py-6 text-lg font-bold text-white hover:bg-[#e600e6]"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>Outbid for ${(session.nextBidAmount / 100).toFixed(0)}</>
                )}
              </Button>
            )}

            {session.status === "open" && isHolder && (
              <div className="rounded-lg bg-gradient-to-r from-[#c4ff0e]/20 to-[#ff00ff]/20 px-4 py-3 text-center text-sm text-white">
                You're winning! {countdown !== null && `${countdown}s left`}
              </div>
            )}

            {session.status === "payment_pending" && isWinner && (
              <Button
                onClick={handlePayNow}
                disabled={isLoading}
                className="w-full bg-[#c4ff0e] py-6 text-lg font-bold text-black hover:bg-[#b3e60d]"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Pay Now - ${(session.currentBid!.amount / 100).toFixed(0)}
                  </>
                )}
              </Button>
            )}

            {session.status === "payment_pending" && !isWinner && (
              <div className="rounded-lg bg-zinc-800 px-4 py-3 text-center text-sm text-zinc-400">
                Waiting for winner to complete payment...
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-600/20 px-4 py-2 text-center text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
