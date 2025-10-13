import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure fal client
fal.config({
  credentials: process.env.FAL_API_KEY || process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Generate anime-style avatar using fal schnell model
    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: "square",
        num_inference_steps: 4,
        num_images: 1,
      },
    })

    // Extract the image URL from the result
    const imageUrl = result.images?.[0]?.url

    if (!imageUrl) {
      throw new Error("No image generated")
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("[v0] Error generating avatar:", error)
    return NextResponse.json({ error: "Failed to generate avatar" }, { status: 500 })
  }
}
