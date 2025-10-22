import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateAvatarImage } from "@/lib/ai/fal";
import { selectNightclubAvatarPrompt } from "@/lib/nightclub/prompts";
import { generateNightclubAvatarPrompts } from "@/lib/ai/openrouter";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// In-memory prompt cache
let promptCache: string[] = [];
let promptIndex = 0;
let isGeneratingPrompts = false;

async function getNextPrompt(): Promise<string> {
  // If cache is empty or exhausted, generate new prompts
  if (promptCache.length === 0 || promptIndex >= promptCache.length) {
    // If already generating, wait and retry
    if (isGeneratingPrompts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return getNextPrompt();
    }

    isGeneratingPrompts = true;
    try {
      console.log("[PROMPT_CACHE] Generating new batch of 10 prompts from OpenRouter...");
      const { prompts } = await generateNightclubAvatarPrompts();
      promptCache = prompts;
      promptIndex = 0;
      console.log("[PROMPT_CACHE] Generated prompts:", prompts);
    } catch (error) {
      console.error("[PROMPT_CACHE] Failed to generate prompts, using fallback", error);
      // Fallback to default prompts
      const { prompt } = selectNightclubAvatarPrompt({});
      return prompt;
    } finally {
      isGeneratingPrompts = false;
    }
  }

  const prompt = promptCache[promptIndex];
  promptIndex++;
  console.log(`[PROMPT_CACHE] Using prompt ${promptIndex}/${promptCache.length}: ${prompt?.substring(0, 60)}...`);
  return prompt || selectNightclubAvatarPrompt({}).prompt;
}

export async function GET() {
  try {
    const avatars = await convex.query(api.nightclub.getActiveAvatars, {});
    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("[nightclub/avatars] GET error", error);
    return NextResponse.json({ error: "Failed to load avatars" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    // Allow both authenticated and anonymous users for nightclub simulation
    const effectiveUserId = userId ?? `anon_${Math.random().toString(36).substring(2, 15)}`;

    console.log(`[NIGHTCLUB_AVATAR] Creating avatar for user: ${effectiveUserId} (authenticated: ${!!userId})`);

    const body = await request.json().catch(() => ({}));
    const requestedPrompt: string | undefined = body.prompt;
    const customSeed: number | undefined = body.seed;
    const queuedAvatar: { imageUrl: string; prompt: string; seed: number; queueId: string } | undefined = body.queuedAvatar;

    // If we have a pre-generated avatar from queue, use it directly
    if (queuedAvatar) {
      console.log(`[NIGHTCLUB_AVATAR] Using pre-generated avatar from queue: ${queuedAvatar.queueId}`);
      
      const userProfile = userId ? await convex.query(api.users.getUserByClerkId, { clerkId: userId }) : null;
      const alias = userProfile?.alias ?? "Anonymous";

      const avatarId = await convex.mutation(api.nightclub.spawnAvatar, {
        clerkId: effectiveUserId,
        aliasSnapshot: alias,
        seed: queuedAvatar.seed,
        prompt: queuedAvatar.prompt,
      });

      await convex.mutation(api.nightclub.setAvatarImage, {
        avatarId,
        imageUrl: queuedAvatar.imageUrl,
      });

      // Remove from queue
      await convex.mutation(api.avatarQueue.deleteAvatar, {
        id: queuedAvatar.queueId as any,
      });

      console.log(`[NIGHTCLUB_AVATAR] Activated queued avatar instantly with ID: ${avatarId}`);
      
      return NextResponse.json(
        {
          avatarId,
          alias,
          seed: queuedAvatar.seed,
          imageUrl: queuedAvatar.imageUrl,
          prompt: queuedAvatar.prompt,
          fromQueue: true,
        },
        { status: 201 }
      );
    }

    // Standard generation path
    const seed: number = Number.isFinite(customSeed) ? customSeed! : Math.floor(Math.random() * 1_000_000);

    console.log(`[NIGHTCLUB_AVATAR] Seed: ${seed}, Custom prompt: ${requestedPrompt ? 'yes' : 'no'}`);

    const userProfile = userId ? await convex.query(api.users.getUserByClerkId, { clerkId: userId }) : null;
    const alias = userProfile?.alias ?? "Anonymous";

    console.log(`[NIGHTCLUB_AVATAR] User alias: ${alias}`);

    // Use OpenRouter-generated prompts for variety, or custom prompt if provided
    const generatedPrompt = requestedPrompt ? null : await getNextPrompt();
    const prompt = requestedPrompt ?? generatedPrompt ?? selectNightclubAvatarPrompt({ alias }).prompt;

    console.log(`[NIGHTCLUB_AVATAR] Using prompt: ${prompt.substring(0, 100)}...`);

    const avatarId = await convex.mutation(api.nightclub.spawnAvatar, {
      clerkId: effectiveUserId,
      aliasSnapshot: alias,
      seed,
      prompt,
    });

    console.log(`[NIGHTCLUB_AVATAR] Avatar spawned with ID: ${avatarId}`);

    try {
      console.log(`[NIGHTCLUB_AVATAR] Starting image generation...`);
      const { imageUrl } = await generateAvatarImage({ prompt, seed });
      
      console.log(`[NIGHTCLUB_AVATAR] Setting avatar image: ${imageUrl}`);
      await convex.mutation(api.nightclub.setAvatarImage, {
        avatarId,
        imageUrl,
      });

      console.log(`[NIGHTCLUB_AVATAR] Avatar fully created with image`);
      return NextResponse.json(
        {
          avatarId,
          alias,
          seed,
          imageUrl,
          prompt,
          fromQueue: false,
        },
        { status: 201 }
      );
    } catch (imageError) {
      console.error("[NIGHTCLUB_AVATAR] Image generation error", imageError);
      return NextResponse.json(
        {
          avatarId,
          alias,
          seed,
          imageError: imageError instanceof Error ? imageError.message : "Unknown image error",
          prompt,
          fromQueue: false,
        },
        { status: 202 }
      );
    }
  } catch (error) {
    console.error("[NIGHTCLUB_AVATAR] POST error", error);
    return NextResponse.json({ error: "Failed to create avatar" }, { status: 500 });
  }
}
