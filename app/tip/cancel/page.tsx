"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function TipCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-zinc-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Tip Cancelled</h1>
          <p className="text-zinc-400 mb-6">
            Your tip was not processed. No charges were made.
          </p>

          <div className="space-y-3">
            <Button onClick={() => router.push("/")} className="w-full">
              Return Home
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
