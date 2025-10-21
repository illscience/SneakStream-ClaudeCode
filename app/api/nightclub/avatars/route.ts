import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateAvatarImage } from "@/lib/ai/fal";
import { selectNightclubAvatarPrompt } from "@/lib/nightclub/prompts";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
    const seed = Number.isFinite(customSeed) ? customSeed : Math.floor(Math.random() * 1_000_000);

    console.log(`[NIGHTCLUB_AVATAR] Seed: ${seed}, Custom prompt: ${requestedPrompt ? 'yes' : 'no'}`);

    const userProfile = userId ? await convex.query(api.users.getUserByClerkId, { clerkId: userId }) : null;
    const alias = userProfile?.alias ?? "Anonymous";

    console.log(`[NIGHTCLUB_AVATAR] User alias: ${alias}`);

    const { prompt: themedPrompt, vibe } = selectNightclubAvatarPrompt({ alias });
    const prompt = requestedPrompt ?? themedPrompt;

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
          vibe,
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
          vibe,
        },
        { status: 202 }
      );
    }
  } catch (error) {
    console.error("[NIGHTCLUB_AVATAR] POST error", error);
    return NextResponse.json({ error: "Failed to create avatar" }, { status: 500 });
  }
}
