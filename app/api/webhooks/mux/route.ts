import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAsset as getMuxAsset } from "@/lib/mux";

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
  const eventAsset = event.data;
  if (!eventAsset?.id) {
    return { ok: false, reason: "Missing asset id" };
  }

  let resolvedAsset = eventAsset;

  if (!resolvedAsset.live_stream_id || !resolvedAsset.status || resolvedAsset.duration === undefined) {
    try {
      resolvedAsset = (await getMuxAsset(eventAsset.id)) as typeof resolvedAsset;
    } catch (error) {
      console.warn("[mux webhook] Failed to fetch full asset data from Mux:", error);
    }
  }

  const liveStreamId = resolvedAsset.live_stream_id || eventAsset.live_stream_id;
  const playbackId =
    resolvedAsset.playback_ids?.find((p) => p.policy === "public")?.id ||
    eventAsset.playback_ids?.find((p) => p.policy === "public")?.id;
  const status = resolvedAsset.status === "ready" ? "ready" : "processing";

  let userId: string | undefined;
  let title = resolvedAsset.passthrough || eventAsset.passthrough || "Stream Recording";
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

  console.log("[mux webhook] Upserting asset:", {
    type: event.type,
    assetId: eventAsset.id,
    liveStreamId,
    status,
  });

  await convex.mutation(api.videos.upsertMuxAsset, {
    assetId: eventAsset.id,
    userId,
    title,
    description,
    playbackId,
    duration: resolvedAsset.duration ?? eventAsset.duration,
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

    console.log("[mux webhook] received", {
      signatureHeader: signatureHeader ? "present" : "missing",
      contentLength: payload.length,
    });

    if (!verification.ok) {
      console.warn("[mux webhook] signature verification failed", {
        reason: verification.reason,
      });
      return NextResponse.json({ error: verification.reason }, { status: 400 });
    }

    const event = JSON.parse(payload) as MuxWebhookEvent;
    if (!event.type) {
      return NextResponse.json({ ok: true });
    }

    const eventAsset = event.data;
    console.log("[mux webhook] event parsed", {
      type: event.type,
      assetId: eventAsset?.id,
      passthrough: eventAsset?.passthrough,
      liveStreamId: eventAsset?.live_stream_id,
      status: eventAsset?.status,
      duration: eventAsset?.duration,
      playbackIds: eventAsset?.playback_ids?.map((p) => ({
        id: p.id,
        policy: p.policy,
      })),
    });

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
