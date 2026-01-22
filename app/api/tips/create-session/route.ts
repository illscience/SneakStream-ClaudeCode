import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createTipCheckoutSession } from "@/lib/stripe";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, message, emoji, videoId, livestreamId } = body;

    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json(
        { error: "Amount must be at least $1.00 (100 cents)" },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: "Amount cannot exceed $1,000" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create Stripe checkout session
    const { sessionId, url } = await createTipCheckoutSession({
      amount,
      senderId: userId,
      message,
      emoji,
      videoId,
      livestreamId,
      successUrl: `${origin}/tip/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/tip/cancel`,
    });

    // Create pending tip in Convex
    await convex.mutation(api.tips.createTip, {
      senderId: userId,
      amount,
      message,
      emoji,
      videoId: videoId ? (videoId as Id<"videos">) : undefined,
      livestreamId: livestreamId ? (livestreamId as Id<"livestreams">) : undefined,
      stripeSessionId: sessionId,
    });

    return NextResponse.json({ sessionId, url });
  } catch (error) {
    console.error("[tips/create-session] Error:", error);
    return NextResponse.json(
      { error: "Failed to create tip session", details: String(error) },
      { status: 500 }
    );
  }
}
