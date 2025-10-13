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
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedPrompt: string | undefined = body.prompt;
    const customSeed: number | undefined = body.seed;
    const seed = Number.isFinite(customSeed) ? customSeed : Math.floor(Math.random() * 1_000_000);

    const userProfile = await convex.query(api.users.getUserByClerkId, { clerkId: userId });
    const alias = userProfile?.alias ?? "Anonymous";

    const { prompt: themedPrompt, vibe } = selectNightclubAvatarPrompt({ alias });
    const prompt = requestedPrompt ?? themedPrompt;

    const avatarId = await convex.mutation(api.nightclub.spawnAvatar, {
      clerkId: userId,
      aliasSnapshot: alias,
      seed,
      prompt,
    });

    try {
      const { imageUrl } = await generateAvatarImage({ prompt, seed });
      await convex.mutation(api.nightclub.setAvatarImage, {
        avatarId,
        imageUrl,
      });

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
      console.error("[nightclub/avatars] Image generation error", imageError);
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
    console.error("[nightclub/avatars] POST error", error);
    return NextResponse.json({ error: "Failed to create avatar" }, { status: 500 });
  }
}
