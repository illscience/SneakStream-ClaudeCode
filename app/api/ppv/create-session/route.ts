import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createPPVCheckoutSession } from "@/lib/stripe";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Fetch video details from Convex
    const video = await convex.query(api.videos.getVideo, {
      videoId: videoId as Id<"videos">,
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.visibility !== "ppv" || !video.price) {
      return NextResponse.json(
        { error: "This video is not available for purchase" },
        { status: 400 }
      );
    }

    // Check if user already has entitlement
    const hasEntitlement = await convex.query(api.entitlements.hasEntitlement, {
      userId,
      videoId: videoId as Id<"videos">,
    });

    if (hasEntitlement) {
      return NextResponse.json(
        { error: "You already have access to this video" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create Stripe checkout session
    const { sessionId, url } = await createPPVCheckoutSession({
      videoId,
      videoTitle: video.title,
      price: video.price,
      buyerId: userId,
      successUrl: `${origin}/watch/${videoId}?purchased=true`,
      cancelUrl: `${origin}/watch/${videoId}?canceled=true`,
    });

    // Create pending purchase in Convex
    await convex.mutation(api.purchases.createPurchase, {
      buyerId: userId,
      videoId: videoId as Id<"videos">,
      amount: video.price,
      stripeSessionId: sessionId,
    });

    return NextResponse.json({ sessionId, url });
  } catch (error) {
    console.error("[ppv/create-session] Error:", error);
    return NextResponse.json(
      { error: "Failed to create purchase session", details: String(error) },
      { status: 500 }
    );
  }
}
