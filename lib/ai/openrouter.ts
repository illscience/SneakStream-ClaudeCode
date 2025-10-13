import type { Id } from "@/convex/_generated/dataModel";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENROUTER_KIMI_MODEL ?? "moonshot/kimi-k2";

interface ParticipantProfile {
  avatarId: Id<"nightclubAvatars">;
  alias: string;
  recentTopic?: string;
}

export interface GenerateConversationPayload {
  participants: ParticipantProfile[];
  recentMessages?: string[];
  clubVibe?: string;
}

export interface GeneratedConversation {
  summary: string;
  transcript: string;
}

const parseJsonContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item && "text" in item) {
          return String(item.text);
        }
        return "";
      })
      .join("")
      .trim();
  }

  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text?: unknown }).text ?? "");
  }

  return "";
};

export const generateNightclubConversation = async ({
  participants,
  recentMessages,
  clubVibe,
}: GenerateConversationPayload): Promise<GeneratedConversation> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const participantSummary = participants
    .map((participant) => `- ${participant.alias}${participant.recentTopic ? ` (vibe: ${participant.recentTopic})` : ""}`)
    .join("\n");

  const history = recentMessages?.map((line) => `• ${line}`)?.join("\n") ?? "None";

  const systemPrompt = `You orchestrate chance conversations between club-goers in a neon underground nightclub.
Return concise JSON with keys "summary" and "transcript".
"summary" should be <= 140 characters describing the moment in energetic tone.
"transcript" should be a short dialogue with speaker prefixes, one line per turn.
Keep it playful, reference music or dance floor energy, and mention sensory details from the club.
Do not include extra keys or narrative outside JSON.`;

  const userPrompt = `Participants:\n${participantSummary}\n\nRecent feed snippets:\n${history}\n\nClub vibe:${clubVibe ? ` ${clubVibe}` : " Synthwave haze"}\n\nWrite the encounter.`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://dj-sneak-stream.local",
      "X-Title": process.env.OPENROUTER_APP_TITLE ?? "DJ Sneak Nightclub",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  const content = parseJsonContent(message?.content);

  try {
    const parsed = JSON.parse(content ?? "{}");
    if (!parsed.summary || !parsed.transcript) {
      throw new Error("Missing fields in parsed response");
    }

    return {
      summary: String(parsed.summary),
      transcript: String(parsed.transcript),
    };
  } catch (error) {
    throw new Error(`Failed to parse OpenRouter response: ${error instanceof Error ? error.message : String(error)}`);
  }
};
