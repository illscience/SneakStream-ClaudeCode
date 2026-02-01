"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Disc3 } from "lucide-react";
import { BidModal } from "./BidModal";

interface AddToCrateButtonProps {
  livestreamId: Id<"livestreams">;
}

export function AddToCrateButton({ livestreamId }: AddToCrateButtonProps) {
  const { user, isLoaded } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Get current bidding session
  const session = useQuery(api.bidding.getCurrentSession, { livestreamId });

  // Don't show button if no active session
  if (!session) {
    return null;
  }

  const handleClick = () => {
    if (!isLoaded) return;

    if (!user) {
      setShowSignInPrompt(true);
      return;
    }

    setIsModalOpen(true);
  };

  // Format current bid amount
  const currentAmount = session.currentBid
    ? `$${(session.currentBid.amount / 100).toFixed(0)}`
    : "$10";

  return (
    <>
      {/* Floating button - bottom right */}
      <button
        onClick={handleClick}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#c4ff0e] to-[#ff00ff] px-4 py-3 font-bold text-black shadow-lg shadow-[#c4ff0e]/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-[#ff00ff]/30 active:scale-95"
      >
        <Disc3 className="h-5 w-5 animate-spin" style={{ animationDuration: "3s" }} />
        <span>Add to Crate</span>
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-sm">
          {currentAmount}
        </span>
      </button>

      {/* Sign in prompt */}
      {showSignInPrompt && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <Disc3 className="mx-auto mb-4 h-12 w-12 text-[#c4ff0e]" />
            <h3 className="mb-2 text-xl font-bold">Sign in to Bid</h3>
            <p className="mb-6 text-sm text-zinc-400">
              You need to be signed in to add tracks to your crate.
            </p>
            <div className="flex flex-col gap-3">
              <SignInButton mode="modal">
                <button className="w-full rounded-lg bg-[#c4ff0e] py-3 font-bold text-black transition-colors hover:bg-[#b3e60d]">
                  Sign In
                </button>
              </SignInButton>
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bid modal */}
      <BidModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        livestreamId={livestreamId}
        session={session}
      />
    </>
  );
}
