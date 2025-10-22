import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"
import { generatePolaroidSelfiePrompt } from "@/lib/nightclub/prompts"

// Configure fal client
fal.config({
  credentials: process.env.FAL_API_KEY || process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { avatar1Url, avatar2Url } = await request.json()

    if (!avatar1Url || !avatar2Url) {
      return NextResponse.json({ error: "Both avatar URLs are required" }, { status: 400 })
    }

    // Generate dynamic selfie-style photo using fal Flux Kontext multi-image
    const prompt = generatePolaroidSelfiePrompt()
    console.log("[Polaroid] Generated prompt:", prompt)
    
    const result = await fal.subscribe("fal-ai/flux-pro/kontext/max/multi", {
      input: {
        prompt,
        image_urls: [avatar1Url, avatar2Url],
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: 5, // Most permissive setting (1-5 scale)
      },
    })

    // Extract the image URL from the result
    const imageUrl = result.images?.[0]?.url

    if (!imageUrl) {
      throw new Error("No image generated")
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("[Polaroid] Error generating polaroid:", error)
    return NextResponse.json({ error: "Failed to generate polaroid" }, { status: 500 })
  }
}
