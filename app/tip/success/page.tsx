"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { Suspense } from "react";

function TipSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const tip = useQuery(
    api.tips.getTipBySession,
    sessionId ? { stripeSessionId: sessionId } : "skip"
  );

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-zinc-400 mb-6">
            Your tip has been sent successfully.
          </p>

          {tip && (
            <div className="bg-zinc-800 rounded-xl p-4 mb-6">
              <p className="text-3xl font-bold text-lime-400">
                ${(tip.amount / 100).toFixed(2)}
              </p>
              {tip.message && (
                <p className="text-zinc-400 mt-2 text-sm">{tip.message}</p>
              )}
            </div>
          )}

          <Button onClick={() => router.push("/")} className="w-full">
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TipSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <TipSuccessContent />
    </Suspense>
  );
}
