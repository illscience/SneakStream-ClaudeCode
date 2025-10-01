"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import VideoFeed from "../components/VideoFeed";
import Link from "next/link";

export default function FeedPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-zinc-400 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Video Feed</h1>
              <p className="text-zinc-400 mt-2">
                {user
                  ? "Latest videos from artists you follow"
                  : "Latest public videos"}
              </p>
            </div>
            {user && (
              <Link href="/upload">
                <button className="px-6 py-3 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300 transition-colors">
                  Upload Video
                </button>
              </Link>
            )}
          </div>
        </div>

        <VideoFeed limit={50} />
      </div>
    </div>
  );
}
