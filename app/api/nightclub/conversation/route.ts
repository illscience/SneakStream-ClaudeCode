import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateNightclubConversation } from "@/lib/ai/openrouter";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ConversationRequestBody {
  avatarA: Id<"nightclubAvatars">;
  avatarB: Id<"nightclubAvatars">;
  clubVibe?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConversationRequestBody;
    const { avatarA, avatarB, clubVibe } = body;

    if (!avatarA || !avatarB) {
      return NextResponse.json({ error: "Missing avatar IDs" }, { status: 400 });
    }

    const { shouldGenerate, encounterId } = await convex.mutation(api.nightclub.beginEncounter, {
      avatarA,
      avatarB,
    });

    if (!encounterId) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    if (!shouldGenerate) {
      return NextResponse.json({ status: "duplicate", encounterId }, { status: 200 });
    }

    const avatars = await convex.query(api.nightclub.getAvatarsByIds, {
      avatarIds: [avatarA, avatarB],
    });

    const participantMap = new Map(avatars.map((avatar) => [avatar._id, avatar]));
    const avatarDetails = [participantMap.get(avatarA), participantMap.get(avatarB)];

    if (avatarDetails.some((avatar) => !avatar)) {
      await convex.mutation(api.nightclub.finalizeEncounter, {
        encounterId,
        transcript: undefined,
        summary: undefined,
        status: "failed",
      });
      return NextResponse.json({ error: "Avatar lookup failed" }, { status: 404 });
    }

    const recentMessages = await convex.query(api.chat.getMessages, {});
    const latestSnippets = recentMessages
      ?.slice(-6)
      .map((message) => `${message.userName ?? message.user ?? "Anon"}: ${message.body}`);

    try {
      const conversation = await generateNightclubConversation({
        participants: avatarDetails.map((avatar) => ({
          avatarId: avatar!._id,
          alias: avatar!.aliasSnapshot,
        })),
        recentMessages: latestSnippets,
        clubVibe,
      });

      await convex.mutation(api.nightclub.finalizeEncounter, {
        encounterId,
        transcript: conversation.transcript,
        summary: conversation.summary,
        status: "completed",
      });

      await Promise.all(
        avatarDetails.map((avatar) =>
          convex.mutation(api.nightclub.touchAvatarConversation, {
            avatarId: avatar!._id,
          })
        )
      );

      await convex.mutation(api.chat.sendMessage, {
        user: "Nightclub",
        userName: "Nightclub",
        body: `🎛️ ${avatarDetails[0]!.aliasSnapshot} × ${avatarDetails[1]!.aliasSnapshot}: ${conversation.summary}\n${conversation.transcript}`,
      });

      return NextResponse.json({
        encounterId,
        ...conversation,
      });
    } catch (generationError) {
      await convex.mutation(api.nightclub.finalizeEncounter, {
        encounterId,
        transcript: undefined,
        summary: generationError instanceof Error ? generationError.message : "Generation failed",
        status: "failed",
      });
      console.error("[nightclub/conversation] generation error", generationError);
      return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[nightclub/conversation] POST error", error);
    return NextResponse.json({ error: "Failed to generate conversation" }, { status: 500 });
  }
}
