"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import { PPVPurchaseButton } from "./PPVPurchaseButton";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

interface PPVGateProps {
  videoId: Id<"videos">;
  videoTitle: string;
  price: number;
  thumbnailUrl?: string;
  children: React.ReactNode;
}

export function PPVGate({
  videoId,
  videoTitle,
  price,
  thumbnailUrl,
  children,
}: PPVGateProps) {
  const { userId, isSignedIn, isLoaded } = useAuth();

  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    userId ? { userId, videoId } : "skip"
  );

  // Admin bypass - admins can view any content without entitlement
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    userId ? { clerkId: userId } : "skip"
  );

  // Show loading state while auth is loading
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center aspect-video bg-muted rounded-lg">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If user has entitlement OR is admin, show the content
  if (isSignedIn && (hasEntitlement || isAdmin)) {
    return <>{children}</>;
  }

  // Show purchase gate
  return (
    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
      {/* Blurred thumbnail background */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-50"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold text-white">{videoTitle}</h2>
          <p className="text-white/80">
            This is exclusive content. Purchase to unlock full access.
          </p>

          <div className="pt-4">
            {isSignedIn ? (
              <PPVPurchaseButton
                videoId={videoId}
                price={price}
                className="bg-primary hover:bg-primary/90"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-white/60 text-sm">
                  Sign in to purchase this video
                </p>
                <SignInButton mode="modal">
                  <Button size="lg">Sign In to Purchase</Button>
                </SignInButton>
              </div>
            )}
          </div>

          <p className="text-white/50 text-sm">
            One-time purchase - Watch anytime
          </p>
        </div>
      </div>
    </div>
  );
}
