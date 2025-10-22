import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateAvatarImage } from "@/lib/ai/fal";
import { generateNightclubAvatarPrompts } from "@/lib/ai/openrouter";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET - Get avatars from shared pool (no deletion, multiple users can use same avatars)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get("count") || "12", 10);

    console.log(`[AVATAR_QUEUE] Getting ${count} avatars from shared pool...`);

    const avatars = await convex.query(api.avatarQueue.getAvatars, {
      count,
    });

    console.log(`[AVATAR_QUEUE] Loaded ${avatars.length} avatars (shared pool)`);

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

    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("[AVATAR_QUEUE] GET error", error);
    return NextResponse.json(
      { error: "Failed to get avatars", avatars: [] },
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

    const total = await convex.query(api.avatarQueue.getTotalCount, {});

    return NextResponse.json({
      total,
      backfillNeeded,
      backfillTriggered: backfillNeeded > 0,
    });
  } catch (error) {
    console.error("[AVATAR_QUEUE] POST error", error);
    return NextResponse.json({ error: "Failed to check queue" }, { status: 500 });
  }
}

