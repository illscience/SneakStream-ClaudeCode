"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function CrateCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
          <p className="text-zinc-400 mb-6">
            Your payment was cancelled. The track moment is still available if you'd like to try again.
          </p>

          <Button
            onClick={() => router.push("/")}
            className="w-full bg-[#c4ff0e] text-black font-bold hover:bg-[#b3e60d]"
          >
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}
