"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId?: Id<"videos">;
  livestreamId?: Id<"livestreams">;
  preselectedAmount?: number | null;
}

const TIP_AMOUNTS = [
  { value: 500, label: "$5" },
  { value: 1000, label: "$10" },
  { value: 2000, label: "$20" },
  { value: 5000, label: "$50" },
];

const TIP_EMOJIS = [
  { value: "fire", label: "Fire", emoji: "🔥" },
  { value: "heart", label: "Heart", emoji: "❤️" },
  { value: "rocket", label: "Rocket", emoji: "🚀" },
  { value: "clap", label: "Clap", emoji: "👏" },
];

export function TipModal({ isOpen, onClose, videoId, livestreamId, preselectedAmount }: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set preselected amount when modal opens
  useEffect(() => {
    if (isOpen && preselectedAmount) {
      setSelectedAmount(preselectedAmount);
      setCustomAmount("");
    }
  }, [isOpen, preselectedAmount]);

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    setCustomAmount(cleaned);
    setSelectedAmount(null);
  };

  const getAmountInCents = (): number => {
    if (selectedAmount) {
      return selectedAmount;
    }
    const parsed = parseFloat(customAmount);
    if (!isNaN(parsed) && parsed >= 1) {
      return Math.round(parsed * 100);
    }
    return 0;
  };

  const handleSubmit = async () => {
    const amountCents = getAmountInCents();
    if (amountCents < 100) {
      setError("Minimum tip amount is $1.00");
      return;
    }
    if (amountCents > 100000) {
      setError("Maximum tip amount is $1,000");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tips/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountCents,
          message: message || undefined,
          emoji: selectedEmoji || undefined,
          videoId: videoId || undefined,
          livestreamId: livestreamId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create tip session");
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAmount(null);
    setCustomAmount("");
    setMessage("");
    setSelectedEmoji(null);
    setError(null);
    onClose();
  };

  const amountCents = getAmountInCents();
  const isValidAmount = amountCents >= 100 && amountCents <= 100000;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a Tip</DialogTitle>
          <DialogDescription>
            Show your support for DJ Sneak with a tip
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Amount</label>
            <div className="grid grid-cols-4 gap-2">
              {TIP_AMOUNTS.map((amount) => (
                <Button
                  key={amount.value}
                  type="button"
                  variant={selectedAmount === amount.value ? "default" : "outline"}
                  onClick={() => {
                    setSelectedAmount(amount.value);
                    setCustomAmount("");
                  }}
                  className={`w-full ${selectedAmount === amount.value ? "bg-[#c4ff0e] text-black font-bold hover:bg-[#b3e60d]" : ""}`}
                >
                  {amount.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Or enter custom amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-input bg-background px-3 py-2 pl-7 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Emoji Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add an emoji (optional)</label>
            <div className="flex gap-2">
              {TIP_EMOJIS.map((emoji) => (
                <button
                  key={emoji.value}
                  type="button"
                  onClick={() =>
                    setSelectedEmoji(selectedEmoji === emoji.value ? null : emoji.value)
                  }
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md border text-xl transition-colors",
                    selectedEmoji === emoji.value
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-accent"
                  )}
                  title={emoji.label}
                >
                  {emoji.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add a message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice..."
              maxLength={200}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/200
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || isLoading}
            className="bg-[#c4ff0e] text-black font-bold hover:bg-[#b3e60d]"
          >
            {isLoading
              ? "Processing..."
              : isValidAmount
              ? `Send $${(amountCents / 100).toFixed(2)}`
              : "Select Amount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
