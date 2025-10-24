"use client";

import { isMuxEnabled } from "@/lib/streamProvider";
import LivepeerGoLivePage from "./LivepeerGoLivePage";
import MuxGoLivePage from "./MuxGoLivePage";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function GoLivePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Check if user is admin
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/upload");
    }
  }, [isLoaded, user, isAdmin, router]);

  // Show loading state
  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Show access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md text-center p-8 bg-zinc-900 border border-zinc-800 rounded-xl">
          <h1 className="text-2xl font-bold mb-4">Admin Only</h1>
          <p className="text-zinc-400 mb-6">
            Live broadcasting is restricted to administrators. You can upload videos to share content!
          </p>
          <Link
            href="/upload"
            className="inline-block px-6 py-3 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300 transition-colors"
          >
            Upload Video
          </Link>
        </div>
      </div>
    );
  }

  return isMuxEnabled() ? <MuxGoLivePage /> : <LivepeerGoLivePage />;
}
