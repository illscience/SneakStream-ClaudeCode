"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Disc3 } from "lucide-react";
import { Suspense } from "react";

function CrateSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <div className="w-16 h-16 bg-[#ff00ff]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Disc3 className="w-8 h-8 text-[#ff00ff]" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Added to Your Crate!</h1>
          <p className="text-zinc-400 mb-6">
            This track moment is now part of your collection.
          </p>

          <div className="bg-zinc-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-400 font-medium">Payment successful</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/profile")}
              className="w-full bg-[#ff00ff] text-white font-bold hover:bg-[#e600e6]"
            >
              View My Crate
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full border-zinc-700 text-white hover:bg-zinc-800"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrateSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <CrateSuccessContent />
    </Suspense>
  );
}
