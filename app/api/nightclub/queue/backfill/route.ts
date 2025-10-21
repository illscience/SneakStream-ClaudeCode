import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateAvatarImage } from "@/lib/ai/fal";
import { generateNightclubAvatarPrompts } from "@/lib/ai/openrouter";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST - Backfill the avatar queue with pre-generated avatars
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({ count: 20 }));
    const count = Math.min(body.count || 20, 20); // Cap at 20

    console.log(`[AVATAR_BACKFILL] Starting backfill of ${count} avatars...`);

    // Generate prompts from OpenRouter
    let prompts: string[];
    try {
      const { prompts: generated } = await generateNightclubAvatarPrompts();
      prompts = generated;
      console.log(`[AVATAR_BACKFILL] Generated ${prompts.length} prompts from OpenRouter`);
    } catch (error) {
      console.error("[AVATAR_BACKFILL] Failed to generate prompts from OpenRouter, using fallback", error);
      return NextResponse.json({ error: "Failed to generate prompts" }, { status: 500 });
    }

    // Generate avatars in parallel (but limit concurrency)
    const results = [];
    const batchSize = 5; // Generate 5 at a time to avoid overwhelming FAL
    
    for (let i = 0; i < count; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j < count; j++) {
        const idx = i + j;
        const prompt = prompts[idx % prompts.length] || prompts[0];
        const seed = Math.floor(Math.random() * 1_000_000);
        
        batch.push(
          generateAvatarImage({ prompt, seed })
            .then(async ({ imageUrl }) => {
              // Add to queue
              await convex.mutation(api.avatarQueue.enqueueAvatar, {
                imageUrl,
                prompt,
                seed,
              });
              console.log(`[AVATAR_BACKFILL] Added avatar ${idx + 1}/${count} to queue`);
              return { success: true, prompt: prompt.substring(0, 60) };
            })
            .catch((error) => {
              console.error(`[AVATAR_BACKFILL] Failed to generate avatar ${idx + 1}:`, error);
              return { success: false, error: error.message };
            })
        );
      }

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const successful = results.filter((r) => r.success).length;
    console.log(`[AVATAR_BACKFILL] Completed: ${successful}/${count} avatars added to queue`);

    return NextResponse.json({
      success: true,
      generated: successful,
      failed: count - successful,
      total: count,
    });
  } catch (error) {
    console.error("[AVATAR_BACKFILL] Error", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}

