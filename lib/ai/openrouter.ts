import type { Id } from "@/convex/_generated/dataModel";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENROUTER_KIMI_MODEL ?? "openai/gpt-4o-mini";

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

export interface GenerateAvatarPromptsResult {
  prompts: string[];
}

export const generateNightclubAvatarPrompts = async (): Promise<GenerateAvatarPromptsResult> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const systemPrompt = `You are a creative director for a trendy underground nightclub. Generate exactly 10 diverse, visually striking prompts for AI image generation of interesting, sexy, fashionable people who might be at the club.

CRITICAL: Maximize variety across ALL dimensions:
- Styles: cyberpunk, retro 80s/90s, Y2K, haute couture, street fashion, punk, glam, minimal chic, maximalist
- Backgrounds: solid colors (red, blue, green, orange, pink, black, white), gradients, neon lights, dark moody, bright vibrant, studio, outdoor
- Lighting: neon, natural, studio, dramatic shadows, colorful gels, backlighting, side lighting, golden hour, cool blue, warm amber
- Color palettes: hot pink/orange, cool blue/cyan, warm golden, electric green, deep red, pastel, monochrome, multicolor
- Ethnicities and features: ensure global diversity
- Genders and expressions: mix masculine, feminine, androgynous energy
- Fashion eras: 70s disco, 80s new wave, 90s rave, 2000s club kid, modern streetwear, futuristic

Each prompt should be detailed (3-4 sentences) and specify background color, lighting type, and mood.
Return as JSON object with key "prompts" containing array of 10 strings.`;

  const userPrompt = `Generate 10 nightclub patron prompts for image generation.`;

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
      temperature: 1.0,
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
    
    // Handle different response formats
    const prompts = parsed.prompts || parsed.avatars || Object.values(parsed);
    
    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error("No prompts array found in response");
    }

    return {
      prompts: prompts.slice(0, 10).map(String),
    };
  } catch (error) {
    throw new Error(`Failed to parse OpenRouter prompts: ${error instanceof Error ? error.message : String(error)}`);
  }
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
