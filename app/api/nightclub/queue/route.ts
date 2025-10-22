import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateAvatarImage } from "@/lib/ai/fal";
import { generateNightclubAvatarPrompts } from "@/lib/ai/openrouter";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET - Dequeue avatars for instant page load
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get("count") || "12", 10);

    console.log(`[AVATAR_QUEUE] Dequeuing ${count} avatars...`);

    const dequeuedAvatars = await convex.mutation(api.avatarQueue.dequeueAvatars, {
      count,
    });

    console.log(`[AVATAR_QUEUE] Dequeued ${dequeuedAvatars.length} avatars`);

    // Trigger backfill asynchronously (don't await)
    const backfillNeeded = await convex.query(api.avatarQueue.getBackfillCount, {});
    if (backfillNeeded > 0) {
      console.log(`[AVATAR_QUEUE] Triggering backfill of ${backfillNeeded} avatars...`);
      // Use fetch to trigger backfill without blocking response
      fetch(`${request.nextUrl.origin}/api/nightclub/queue/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: backfillNeeded }),
      }).catch((err) => console.error("[AVATAR_QUEUE] Backfill trigger failed:", err));
    }

    return NextResponse.json({ avatars: dequeuedAvatars });
  } catch (error) {
    console.error("[AVATAR_QUEUE] GET error", error);
    return NextResponse.json(
      { error: "Failed to dequeue avatars", avatars: [] },
      { status: 500 }
    );
  }
}

/**
 * POST - Get queue stats and trigger backfill if needed
 */
export async function POST(request: NextRequest) {
  try {
    const backfillNeeded = await convex.query(api.avatarQueue.getBackfillCount, {});
    
    if (backfillNeeded > 0) {
      console.log(`[AVATAR_QUEUE] Triggering backfill of ${backfillNeeded} avatars...`);
      
      // Trigger backfill asynchronously
      fetch(`${request.nextUrl.origin}/api/nightclub/queue/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: backfillNeeded }),
      }).catch((err) => console.error("[AVATAR_QUEUE] Backfill trigger failed:", err));
    }

    const available = await convex.query(api.avatarQueue.getAvailableCount, {});
    const total = await convex.query(api.avatarQueue.getTotalCount, {});

    return NextResponse.json({
      available,
      total,
      backfillNeeded,
      backfillTriggered: backfillNeeded > 0,
    });
  } catch (error) {
    console.error("[AVATAR_QUEUE] POST error", error);
    return NextResponse.json({ error: "Failed to check queue" }, { status: 500 });
  }
}

/**
 * DELETE - Remove avatar from queue after it's been activated
 * Or cleanup all stale reservations if ?cleanup=true
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cleanup = searchParams.get("cleanup") === "true";

    // Cleanup mode: unreserve all stuck avatars
    if (cleanup) {
      console.log(`[AVATAR_QUEUE] Running cleanup - unreserving all reserved avatars...`);
      const unreservedCount = await convex.mutation(api.avatarQueue.unreserveAll, {});
      console.log(`[AVATAR_QUEUE] Unreserved ${unreservedCount} avatars`);
      
      const available = await convex.query(api.avatarQueue.getAvailableCount, {});
      console.log(`[AVATAR_QUEUE] Available avatars after cleanup: ${available}`);
      
      return NextResponse.json({ success: true, unreservedCount, available });
    }

    // Normal mode: delete specific avatar
    const body = await request.json();
    const { queueId } = body;

    if (!queueId) {
      return NextResponse.json({ error: "queueId is required" }, { status: 400 });
    }

    console.log(`[AVATAR_QUEUE] Deleting avatar ${queueId} from queue`);

    await convex.mutation(api.avatarQueue.removeFromQueue, {
      queueId,
    });

    console.log(`[AVATAR_QUEUE] Successfully deleted avatar ${queueId}`);

    // Trigger backfill asynchronously to replace deleted avatar
    const backfillNeeded = await convex.query(api.avatarQueue.getBackfillCount, {});
    if (backfillNeeded > 0) {
      console.log(`[AVATAR_QUEUE] Triggering backfill of ${backfillNeeded} avatars...`);
      fetch(`${request.nextUrl.origin}/api/nightclub/queue/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Math.min(backfillNeeded, 5) }), // Backfill in smaller batches
      }).catch((err) => console.error("[AVATAR_QUEUE] Backfill trigger failed:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AVATAR_QUEUE] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete avatar from queue" }, { status: 500 });
  }
}

