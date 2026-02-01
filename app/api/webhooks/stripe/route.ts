import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyWebhookSignature, type CheckoutMetadata } from "@/lib/stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");

    if (!signatureHeader) {
      console.warn("[stripe webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    console.log("[stripe webhook] received", {
      signatureHeader: "present",
      contentLength: payload.length,
    });

    let event;
    try {
      event = await verifyWebhookSignature(payload, signatureHeader);
    } catch (err) {
      console.warn("[stripe webhook] signature verification failed", { error: err });
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log("[stripe webhook] event parsed", {
      type: event.type,
      id: event.id,
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata as unknown as CheckoutMetadata;

        console.log("[stripe webhook] checkout.session.completed", {
          sessionId: session.id,
          metadata,
        });

        if (metadata?.type === "tip") {
          await convex.mutation(api.tips.completeTip, {
            stripeSessionId: session.id,
          });
          console.log("[stripe webhook] Tip completed", { sessionId: session.id });
        } else if (metadata?.type === "ppv") {
          await convex.mutation(api.purchases.completePurchase, {
            stripeSessionId: session.id,
          });
          console.log("[stripe webhook] PPV purchase completed", {
            sessionId: session.id,
          });
        } else if (metadata?.type === "livestream_ppv") {
          await convex.mutation(api.purchases.completePurchase, {
            stripeSessionId: session.id,
          });
          console.log("[stripe webhook] Livestream PPV purchase completed", {
            sessionId: session.id,
          });
        } else if (metadata?.type === "bid") {
          const bidMetadata = metadata as { type: "bid"; bidderId: string; sessionId: string; amount: number };
          await convex.mutation(api.bidding.completeCratePurchase, {
            stripeSessionId: session.id,
            sessionId: bidMetadata.sessionId as any,
            bidderId: bidMetadata.bidderId,
            amount: bidMetadata.amount,
          });
          console.log("[stripe webhook] Crate purchase completed", {
            sessionId: session.id,
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const metadata = session.metadata as unknown as CheckoutMetadata;

        console.log("[stripe webhook] checkout.session.expired", {
          sessionId: session.id,
          metadata,
        });

        if (metadata?.type === "tip") {
          await convex.mutation(api.tips.failTip, {
            stripeSessionId: session.id,
          });
        } else if (metadata?.type === "ppv" || metadata?.type === "livestream_ppv") {
          await convex.mutation(api.purchases.failPurchase, {
            stripeSessionId: session.id,
          });
        } else if (metadata?.type === "bid") {
          await convex.mutation(api.bidding.failCratePurchase, {
            stripeSessionId: session.id,
          });
          console.log("[stripe webhook] Crate purchase failed/expired", {
            sessionId: session.id,
          });
        }
        break;
      }

      default:
        console.log("[stripe webhook] Unhandled event type:", event.type);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stripe webhook] Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
