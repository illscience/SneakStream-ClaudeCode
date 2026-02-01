import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Please set it in your environment."
    );
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
  });

  return stripeClient;
}

export interface TipMetadata {
  type: "tip";
  senderId: string;
  amount: number;
  message?: string;
  emoji?: string;
  videoId?: string;
  livestreamId?: string;
}

export interface PPVMetadata {
  type: "ppv";
  buyerId: string;
  videoId: string;
  amount: number;
}

export interface LivestreamPPVMetadata {
  type: "livestream_ppv";
  buyerId: string;
  livestreamId: string;
  amount: number;
}

export interface BidMetadata {
  type: "bid";
  bidderId: string;
  sessionId: string;
  amount: number;
}

export type CheckoutMetadata = TipMetadata | PPVMetadata | LivestreamPPVMetadata | BidMetadata;

export async function createTipCheckoutSession(params: {
  amount: number;
  senderId: string;
  message?: string;
  emoji?: string;
  videoId?: string;
  livestreamId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  const metadata: TipMetadata = {
    type: "tip",
    senderId: params.senderId,
    amount: params.amount,
    message: params.message,
    emoji: params.emoji,
    videoId: params.videoId,
    livestreamId: params.livestreamId,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tip for DJ Sneak",
            description: params.message || "Thank you for your support!",
          },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    metadata: metadata as unknown as Stripe.MetadataParam,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function createPPVCheckoutSession(params: {
  videoId: string;
  videoTitle: string;
  price: number;
  buyerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  const metadata: PPVMetadata = {
    type: "ppv",
    buyerId: params.buyerId,
    videoId: params.videoId,
    amount: params.price,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `PPV: ${params.videoTitle}`,
            description: "One-time access to this video",
          },
          unit_amount: params.price,
        },
        quantity: 1,
      },
    ],
    metadata: metadata as unknown as Stripe.MetadataParam,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function createLivestreamPPVCheckoutSession(params: {
  livestreamId: string;
  livestreamTitle: string;
  price: number;
  buyerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  const metadata: LivestreamPPVMetadata = {
    type: "livestream_ppv",
    buyerId: params.buyerId,
    livestreamId: params.livestreamId,
    amount: params.price,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Live Stream: ${params.livestreamTitle}`,
            description: "Access to this live stream + future recording",
          },
          unit_amount: params.price,
        },
        quantity: 1,
      },
    ],
    metadata: metadata as unknown as Stripe.MetadataParam,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function createBidCheckoutSession(params: {
  sessionId: string;
  amount: number;
  bidderId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  const metadata: BidMetadata = {
    type: "bid",
    bidderId: params.bidderId,
    sessionId: params.sessionId,
    amount: params.amount,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Track Crate Purchase",
            description: "Add this track moment to your crate collection",
          },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    metadata: metadata as unknown as Stripe.MetadataParam,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured. Please set it in your environment."
    );
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}
