import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { avatar1Subject, avatar2Subject } = await request.json()

    const { text } = await generateText({
      model: openrouter("google/gemini-flash-1.5"),
      prompt: `You are generating a short, casual conversation snippet between two people/animals at a 1980s California beach nightclub. Keep it fun, authentic to the 80s surf culture, and under 100 characters.

Avatar 1: ${avatar1Subject}
Avatar 2: ${avatar2Subject}

Generate a single line of dialogue that one of them might say to the other. Use 80s slang like "rad", "gnarly", "tubular", "stoked", "dude", etc. Make it feel natural and spontaneous, like overhearing a snippet of conversation at a party.

Just return the dialogue line, nothing else.`,
    })

    return Response.json({ conversation: text.trim() })
  } catch (error) {
    console.error("[v0] Error generating conversation:", error)
    return Response.json({ conversation: "Dude, the vibes here are totally rad!" }, { status: 500 })
  }
}
