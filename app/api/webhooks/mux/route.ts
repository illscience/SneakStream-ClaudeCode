import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type MuxWebhookEvent = {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    duration?: number;
    live_stream_id?: string;
    passthrough?: string;
    playback_ids?: Array<{ id?: string; policy?: string }>;
  };
};

const parseMuxSignature = (headerValue: string | null) => {
  if (!headerValue) return null;

  const parts = headerValue.split(",").map((part) => part.trim());
  let timestamp = "";
  let signature = "";

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signature = value;
    }
  }

  if (!timestamp || !signature) return null;
  return { timestamp, signature };
};

const verifySignature = (payload: string, headerValue: string | null) => {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("MUX_WEBHOOK_SECRET is not configured");
  }

  const parsed = parseMuxSignature(headerValue);
  if (!parsed) {
    return { ok: false, reason: "Missing or invalid Mux-Signature header" };
  }

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "Invalid timestamp in signature" };
  }

  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "Signature timestamp out of tolerance" };
  }

  const message = `${parsed.timestamp}.${payload}`;
  const digest = createHmac("sha256", secret).update(message).digest("hex");

  const expected = Buffer.from(digest, "utf8");
  const provided = Buffer.from(parsed.signature, "utf8");
  if (expected.length !== provided.length) {
    return { ok: false, reason: "Signature mismatch" };
  }

  const matches = timingSafeEqual(expected, provided);
  return matches ? { ok: true } : { ok: false, reason: "Signature mismatch" };
};

async function upsertMuxAsset(event: MuxWebhookEvent) {
  const asset = event.data;
  if (!asset?.id) {
    return { ok: false, reason: "Missing asset id" };
  }

  const liveStreamId = asset.live_stream_id;
  const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
  const status = asset.status === "ready" ? "ready" : "processing";

  let userId: string | undefined;
  let title = asset.passthrough || "Stream Recording";
  let description = "Recorded via Mux";

  if (liveStreamId) {
    const stream = await convex.query(api.livestream.getStreamByStreamId, {
      streamId: liveStreamId,
    });

    if (stream) {
      userId = stream.userId;
      title = stream.title || title;
      description = stream.description || description;
    }
  }

  if (!userId) {
    return { ok: false, reason: "No matching livestream/user for asset" };
  }

  await convex.mutation(api.videos.upsertMuxAsset, {
    assetId: asset.id,
    userId,
    title,
    description,
    playbackId,
    duration: asset.duration,
    status,
    visibility: "public",
    liveStreamId,
  });

  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signatureHeader = request.headers.get("Mux-Signature");
    const verification = verifySignature(payload, signatureHeader);

    if (!verification.ok) {
      return NextResponse.json({ error: verification.reason }, { status: 400 });
    }

    const event = JSON.parse(payload) as MuxWebhookEvent;
    if (!event.type) {
      return NextResponse.json({ ok: true });
    }

    if (event.type === "video.asset.created" || event.type === "video.asset.ready") {
      const result = await upsertMuxAsset(event);
      if (!result.ok) {
        console.warn("[mux webhook] Upsert skipped:", result.reason);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mux webhook] Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
