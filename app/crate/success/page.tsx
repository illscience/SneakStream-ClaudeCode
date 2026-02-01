"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Disc3, Loader2, AlertCircle } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

function CrateSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function verifyPayment() {
      if (!sessionId) {
        setStatus("error");
        setErrorMessage("No session ID provided");
        return;
      }

      try {
        const response = await fetch("/api/bidding/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripeSessionId: sessionId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
        } else {
          // If it's already processed, that's still a success
          if (data.alreadyProcessed) {
            setStatus("success");
          } else {
            setStatus("error");
            setErrorMessage(data.error || "Failed to verify payment");
          }
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("error");
        setErrorMessage("Failed to verify payment. Please check your profile.");
      }
    }

    verifyPayment();
  }, [sessionId]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <div className="w-16 h-16 bg-[#ff00ff]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-[#ff00ff] animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
            <p className="text-zinc-400">
              Please wait while we verify your payment and add the track to your crate.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verification Issue</h1>
            <p className="text-zinc-400 mb-6">
              {errorMessage || "There was an issue verifying your payment."}
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              If your payment was successful, the track should still appear in your crate.
            </p>
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
