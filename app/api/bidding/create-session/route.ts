import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createBidCheckoutSession } from "@/lib/stripe";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get the bidding session directly by ID and verify user is winner
    const session = await convex.query(api.bidding.getSessionForPayment, {
      sessionId: sessionId as Id<"biddingSessions">,
      userId,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Bidding session not found" },
        { status: 404 }
      );
    }

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: 400 }
      );
    }

    if (!session.currentBid) {
      return NextResponse.json(
        { error: "No winning bid found" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create Stripe checkout session
    const { sessionId: stripeSessionId, url } = await createBidCheckoutSession({
      sessionId: session._id,
      amount: session.currentBid.amount,
      bidderId: userId,
      successUrl: `${origin}/crate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/crate/cancel`,
    });

    return NextResponse.json({ sessionId: stripeSessionId, url });
  } catch (error) {
    console.error("[bidding/create-session] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: String(error) },
      { status: 500 }
    );
  }
}
