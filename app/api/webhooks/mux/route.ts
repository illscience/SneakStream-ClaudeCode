import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAsset as getMuxAsset } from "@/lib/mux";
import { ADMIN_LIBRARY_USER_ID } from "@/lib/adminConstants";
import { logTrace } from "@/lib/debugLog";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type MuxWebhookEvent = {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    duration?: number;
    created_at?: number;
    live_stream_id?: string;
    passthrough?: string;
    playback_ids?: Array<{ id?: string; policy?: string }>;
    // For live_stream events
    active_asset_id?: string;
    // For master access events
    master?: {
      status?: string;
      url?: string;
    };
  };
};

function toTimestampMs(value?: number) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value > 1_000_000_000_000 ? value : value * 1000;
}

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

const isTraceIdValidatorError = (error: unknown) => {
  const msg = String(error);
  return msg.includes("ArgumentValidationError") && msg.includes("`traceId`");
};

const isRecordingLookupValidatorError = (error: unknown) => {
  const msg = String(error);
  return (
    msg.includes("ArgumentValidationError") &&
    (msg.includes("`recordingCreatedAt`") || msg.includes("`recordingObservedAt`"))
  );
};

function buildMuxTraceId(event: MuxWebhookEvent, signatureTimestampSeconds?: number) {
  const eventType = event.type || "unknown";
  const assetId = event.data?.id || "unknown";
  const bucket = Number.isFinite(signatureTimestampSeconds)
    ? Math.floor((signatureTimestampSeconds as number) / 30)
    : Math.floor(Date.now() / 1000 / 30);
  return `mux:${eventType}:${assetId}:${bucket}`;
}

async function upsertMuxAsset(event: MuxWebhookEvent, traceId: string) {
  const eventAsset = event.data;
  if (!eventAsset?.id) {
    logTrace("mux-webhook", "upsert_skipped_missing_asset_id", {
      traceId,
      eventType: event.type,
    });
    console.warn("[mux webhook] upsertMuxAsset: missing asset id, skipping");
    return { ok: false, reason: "missing_asset_id" };
  }

  logTrace("mux-webhook", "upsert_start", {
    traceId,
    eventType: event.type,
    assetId: eventAsset.id,
    liveStreamId: eventAsset.live_stream_id,
    status: eventAsset.status,
  });
  console.log("[mux webhook] upsertMuxAsset: processing asset", {
    assetId: eventAsset.id,
    eventType: event.type,
    liveStreamId: eventAsset.live_stream_id,
    status: eventAsset.status,
  });

  // Do not publish on created. Wait for ready/live_stream_completed.
  if (event.type === "video.asset.created") {
    try {
      await convex.mutation(api.videos.recordMuxAssetCandidate, {
        assetId: eventAsset.id,
        liveStreamId: eventAsset.live_stream_id,
        playbackId: eventAsset.playback_ids?.find((p) => p.policy === "public")?.id,
        duration: eventAsset.duration,
        status: eventAsset.status,
        reason: "waiting_for_ready_or_completed",
        eventType: event.type,
        traceId,
      });
    } catch (error) {
      if (!isTraceIdValidatorError(error)) {
        throw error;
      }
      await convex.mutation(api.videos.recordMuxAssetCandidate, {
        assetId: eventAsset.id,
        liveStreamId: eventAsset.live_stream_id,
        playbackId: eventAsset.playback_ids?.find((p) => p.policy === "public")?.id,
        duration: eventAsset.duration,
        status: eventAsset.status,
        reason: "waiting_for_ready_or_completed",
        eventType: event.type,
      });
    }
    return { ok: true, matchedStream: false, reason: "created_event_deferred" };
  }

  let resolvedAsset = eventAsset;
  if (
    !resolvedAsset.live_stream_id ||
    !resolvedAsset.status ||
    resolvedAsset.duration === undefined ||
    resolvedAsset.created_at === undefined
  ) {
    try {
      console.log("[mux webhook] Fetching full asset data from Mux API...");
      resolvedAsset = (await getMuxAsset(eventAsset.id)) as typeof resolvedAsset;
      logTrace("mux-webhook", "upsert_fetched_asset_details", {
        traceId,
        assetId: eventAsset.id,
        liveStreamId: resolvedAsset.live_stream_id,
        status: resolvedAsset.status,
        duration: resolvedAsset.duration,
        createdAt: resolvedAsset.created_at,
      });
      console.log("[mux webhook] Fetched asset data:", {
        assetId: eventAsset.id,
        liveStreamId: resolvedAsset.live_stream_id,
        status: resolvedAsset.status,
        duration: resolvedAsset.duration,
        createdAt: resolvedAsset.created_at,
      });
    } catch (error) {
      logTrace("mux-webhook", "upsert_fetch_asset_details_error", {
        traceId,
        assetId: eventAsset.id,
        error: String(error),
      });
      console.warn("[mux webhook] Failed to fetch full asset data from Mux:", error);
    }
  }

  const liveStreamId = resolvedAsset.live_stream_id || eventAsset.live_stream_id;
  const playbackId =
    resolvedAsset.playback_ids?.find((p) => p.policy === "public")?.id ||
    eventAsset.playback_ids?.find((p) => p.policy === "public")?.id;
  const status = resolvedAsset.status === "ready" ? "ready" : "processing";
  const recordingCreatedAt = toTimestampMs(resolvedAsset.created_at ?? eventAsset.created_at);
  const recordingObservedAt = Date.now();

  let uploadedBy: string | undefined;
  let title = resolvedAsset.passthrough || eventAsset.passthrough || "Stream Recording";
  let description = "Recorded via Mux";
  let matchedStream = false;
  let linkedLivestreamId: string | undefined;
  let unmatchedReason = liveStreamId ? "livestream_not_found_or_ambiguous" : "missing_live_stream_id";

  if (liveStreamId) {
    console.log("[mux webhook] Looking up livestream in Convex...", { liveStreamId });
    logTrace("mux-webhook", "upsert_lookup_livestream", {
      traceId,
      liveStreamId,
      assetId: eventAsset.id,
      recordingCreatedAt,
      recordingObservedAt,
    });
    let stream:
      | {
          _id: string;
          title: string;
          description?: string;
          startedBy?: string;
          userId: string;
        }
      | null = null;
    try {
      stream = await convex.query(api.livestream.getStreamByStreamId, {
        streamId: liveStreamId,
        recordingCreatedAt,
        recordingObservedAt,
      });
    } catch (error) {
      if (!isRecordingLookupValidatorError(error)) {
        throw error;
      }
      logTrace("mux-webhook", "upsert_lookup_retry_without_recording_timestamps", {
        traceId,
        liveStreamId,
        error: String(error),
      });
      stream = await convex.query(api.livestream.getStreamByStreamId, {
        streamId: liveStreamId,
      });
    }

    if (stream) {
      matchedStream = true;
      uploadedBy = stream.startedBy || stream.userId;
      title = stream.title || title;
      description = stream.description || description;
      linkedLivestreamId = stream._id;
      unmatchedReason = "";
      console.log("[mux webhook] Found matching livestream", {
        streamId: stream._id,
        streamTitle: stream.title,
        startedBy: stream.startedBy,
        userId: stream.userId,
      });
      logTrace("mux-webhook", "upsert_matched_livestream", {
        traceId,
        assetId: eventAsset.id,
        liveStreamId,
        linkedLivestreamId,
        uploadedBy,
      });
    } else {
      console.log("[mux webhook] No confident livestream match found", { liveStreamId });
      logTrace("mux-webhook", "upsert_livestream_not_found", {
        traceId,
        assetId: eventAsset.id,
        liveStreamId,
        recordingCreatedAt,
        recordingObservedAt,
      });
    }
  }

  if (!matchedStream) {
    logTrace("mux-webhook", "upsert_record_candidate_unmatched", {
      traceId,
      assetId: eventAsset.id,
      liveStreamId,
      reason: unmatchedReason,
      eventType: event.type,
      recordingCreatedAt,
      recordingObservedAt,
    });
    try {
      await convex.mutation(api.videos.recordMuxAssetCandidate, {
        assetId: eventAsset.id,
        liveStreamId,
        playbackId,
        duration: resolvedAsset.duration ?? eventAsset.duration,
        status,
        reason: unmatchedReason,
        eventType: event.type || "unknown",
        traceId,
      });
    } catch (error) {
      if (!isTraceIdValidatorError(error)) {
        throw error;
      }
      await convex.mutation(api.videos.recordMuxAssetCandidate, {
        assetId: eventAsset.id,
        liveStreamId,
        playbackId,
        duration: resolvedAsset.duration ?? eventAsset.duration,
        status,
        reason: unmatchedReason,
        eventType: event.type || "unknown",
      });
    }
    return { ok: false, reason: unmatchedReason };
  }

  console.log("[mux webhook] Upserting video record", {
    type: event.type,
    assetId: eventAsset.id,
    liveStreamId,
    linkedLivestreamId,
    playbackId,
    status,
    userId: ADMIN_LIBRARY_USER_ID,
    uploadedBy,
    title,
    matchedStream,
  });
  logTrace("mux-webhook", "upsert_dispatch_to_convex", {
    traceId,
    type: event.type,
    assetId: eventAsset.id,
    liveStreamId,
    linkedLivestreamId,
    playbackId,
    status,
    userId: ADMIN_LIBRARY_USER_ID,
    uploadedBy,
    title,
  });

  try {
    await convex.mutation(api.videos.upsertMuxAsset, {
      assetId: eventAsset.id,
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy,
      title,
      description,
      playbackId,
      duration: resolvedAsset.duration ?? eventAsset.duration,
      status,
      visibility: "public",
      liveStreamId,
      traceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linkedLivestreamId: linkedLivestreamId as any,
    });
  } catch (error) {
    if (!isTraceIdValidatorError(error)) {
      throw error;
    }

    logTrace("mux-webhook", "upsert_retry_without_traceId", {
      traceId,
      assetId: eventAsset.id,
      error: String(error),
    });
    await convex.mutation(api.videos.upsertMuxAsset, {
      assetId: eventAsset.id,
      userId: ADMIN_LIBRARY_USER_ID,
      uploadedBy,
      title,
      description,
      playbackId,
      duration: resolvedAsset.duration ?? eventAsset.duration,
      status,
      visibility: "public",
      liveStreamId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linkedLivestreamId: linkedLivestreamId as any,
    });
  }

  logTrace("mux-webhook", "upsert_convex_success", {
    traceId,
    assetId: eventAsset.id,
    status,
    matchedStream,
  });
  console.log("[mux webhook] Successfully upserted video record", {
    assetId: eventAsset.id,
    status,
    matchedStream,
  });

  return { ok: true, matchedStream };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signatureHeader = request.headers.get("Mux-Signature");
    const verification = verifySignature(payload, signatureHeader);
    const parsedSignature = parseMuxSignature(signatureHeader);
    const signatureTimestamp = parsedSignature ? Number(parsedSignature.timestamp) : undefined;
    const traceId = buildMuxTraceId({}, signatureTimestamp);

    logTrace("mux-webhook", "request_received", {
      traceId,
      signatureHeaderPresent: !!signatureHeader,
      contentLength: payload.length,
    });
    console.log("[mux webhook] received", {
      signatureHeader: signatureHeader ? "present" : "missing",
      contentLength: payload.length,
    });

    if (!verification.ok) {
      logTrace("mux-webhook", "signature_verification_failed", {
        traceId,
        reason: verification.reason,
      });
      console.warn("[mux webhook] signature verification failed", {
        reason: verification.reason,
      });
      return NextResponse.json({ error: verification.reason, traceId }, { status: 400 });
    }

    const event = JSON.parse(payload) as MuxWebhookEvent;
    const eventTraceId = buildMuxTraceId(
      event,
      signatureTimestamp
    );
    if (!event.type) {
      logTrace("mux-webhook", "event_missing_type", {
        traceId: eventTraceId,
      });
      return NextResponse.json({ ok: true, traceId: eventTraceId });
    }

    const eventAsset = event.data;
    logTrace("mux-webhook", "event_parsed", {
      traceId: eventTraceId,
      type: event.type,
      assetId: eventAsset?.id,
      liveStreamId: eventAsset?.live_stream_id,
      status: eventAsset?.status,
      duration: eventAsset?.duration,
    });
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

    if (
      event.type === "video.asset.created" ||
      event.type === "video.asset.ready" ||
      event.type === "video.asset.live_stream_completed"
    ) {
      const result = await upsertMuxAsset(event, eventTraceId);
      if (!result.ok) {
        logTrace("mux-webhook", "upsert_skipped", {
          traceId: eventTraceId,
          type: event.type,
          reason: result.reason,
          assetId: eventAsset?.id,
        });
        console.warn("[mux webhook] Upsert skipped:", result.reason);
      }
    }

    // Handle live stream becoming active - this is when actual video starts streaming
    // Update startedAt to accurate timestamp for correct video deep linking
    if (event.type === "video.live_stream.active") {
      const liveStreamId = eventAsset?.id;
      if (liveStreamId) {
        console.log("[mux webhook] Live stream active, updating startedAt", { liveStreamId });
        try {
          await convex.mutation(api.livestream.updateStreamStartedAt, {
            streamId: liveStreamId,
            startedAt: Date.now(),
          });
          console.log("[mux webhook] Successfully updated startedAt for stream", { liveStreamId });
        } catch (error) {
          console.warn("[mux webhook] Failed to update startedAt:", error);
        }
      }
    }

    // Handle master access webhooks for video downloads
    if (event.type === "video.asset.master.preparing") {
      const assetId = eventAsset?.id;
      if (assetId) {
        logTrace("mux-webhook", "master_preparing", {
          traceId: eventTraceId,
          assetId,
        });
        console.log("[mux webhook] Master preparing", { assetId });
        try {
          await convex.mutation(api.videos.updateMasterStatusByAssetId, {
            assetId,
            status: "preparing",
          });
        } catch (error) {
          console.warn("[mux webhook] Failed to update master status (preparing):", error);
        }
      }
    }

    if (event.type === "video.asset.master.ready") {
      const assetId = eventAsset?.id;
      const masterUrl = eventAsset?.master?.url;
      if (assetId && masterUrl) {
        logTrace("mux-webhook", "master_ready", {
          traceId: eventTraceId,
          assetId,
          hasUrl: !!masterUrl,
        });
        console.log("[mux webhook] Master ready", { assetId, hasUrl: !!masterUrl });
        const MASTER_URL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
        try {
          await convex.mutation(api.videos.updateMasterStatusByAssetId, {
            assetId,
            status: "ready",
            masterUrl,
            masterExpiresAt: Date.now() + MASTER_URL_EXPIRY_MS,
          });
        } catch (error) {
          console.warn("[mux webhook] Failed to update master status (ready):", error);
        }
      }
    }

    if (event.type === "video.asset.master.deleted" || event.type === "video.asset.master.errored") {
      const assetId = eventAsset?.id;
      if (assetId) {
        logTrace("mux-webhook", "master_deleted_or_errored", {
          traceId: eventTraceId,
          assetId,
          type: event.type,
        });
        console.log("[mux webhook] Master deleted/errored", { assetId, type: event.type });
        try {
          await convex.mutation(api.videos.clearMasterByAssetId, {
            assetId,
          });
        } catch (error) {
          console.warn("[mux webhook] Failed to clear master status:", error);
        }
      }
    }

    return NextResponse.json({ ok: true, traceId: eventTraceId });
  } catch (error) {
    logTrace("mux-webhook", "request_error", {
      error: String(error),
    });
    console.error("[mux webhook] Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
