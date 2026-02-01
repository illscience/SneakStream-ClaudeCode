import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getCheckoutSession } from "@/lib/stripe";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// This endpoint verifies a Stripe checkout session and completes the crate purchase
// Useful as a fallback when webhooks aren't configured (local dev)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stripeSessionId } = body;

    if (!stripeSessionId) {
      return NextResponse.json(
        { error: "Stripe session ID is required" },
        { status: 400 }
      );
    }

    // Verify the checkout session with Stripe
    const checkoutSession = await getCheckoutSession(stripeSessionId);

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const metadata = checkoutSession.metadata;
    if (!metadata || metadata.type !== "bid") {
      return NextResponse.json(
        { error: "Invalid session type" },
        { status: 400 }
      );
    }

    // Verify the user is the bidder
    if (metadata.bidderId !== userId) {
      return NextResponse.json(
        { error: "Session does not belong to this user" },
        { status: 403 }
      );
    }

    // Check if already processed (crate entry exists)
    const existingCrate = await convex.query(api.bidding.getSessionByStripeId, {
      stripeSessionId,
    });

    if (existingCrate) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        crateId: existingCrate._id
      });
    }

    // Complete the crate purchase
    const crateId = await convex.mutation(api.bidding.completeCratePurchase, {
      stripeSessionId,
      sessionId: metadata.sessionId as Id<"biddingSessions">,
      bidderId: metadata.bidderId,
      amount: parseInt(metadata.amount, 10),
    });

    console.log("[bidding/verify-payment] Crate purchase completed", {
      stripeSessionId,
      crateId,
    });

    return NextResponse.json({ success: true, crateId });
  } catch (error) {
    console.error("[bidding/verify-payment] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment", details: String(error) },
      { status: 500 }
    );
  }
}
