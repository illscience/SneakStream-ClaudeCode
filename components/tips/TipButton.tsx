"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TipModal } from "./TipModal";
import { useAuth } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";

interface TipButtonProps {
  videoId?: Id<"videos">;
  livestreamId?: Id<"livestreams">;
  className?: string;
}

export function TipButton({ videoId, livestreamId, className }: TipButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className={className}
      >
        Send Tip
      </Button>
      <TipModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        videoId={videoId}
        livestreamId={livestreamId}
      />
    </>
  );
}
