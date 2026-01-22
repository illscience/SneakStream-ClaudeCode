"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";

interface PPVPurchaseButtonProps {
  videoId: Id<"videos">;
  price: number; // in cents
  className?: string;
  onPurchaseStart?: () => void;
}

export function PPVPurchaseButton({
  videoId,
  price,
  className,
  onPurchaseStart,
}: PPVPurchaseButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useAuth();

  const handlePurchase = async () => {
    if (!isSignedIn) {
      // Could redirect to sign-in or show a modal
      setError("Please sign in to purchase");
      return;
    }

    setIsLoading(true);
    setError(null);
    onPurchaseStart?.();

    try {
      const response = await fetch("/api/ppv/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create purchase session");
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const priceDisplay = `$${(price / 100).toFixed(2)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handlePurchase}
        disabled={isLoading}
        size="lg"
        className={className}
      >
        {isLoading ? "Processing..." : `Buy for ${priceDisplay}`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
