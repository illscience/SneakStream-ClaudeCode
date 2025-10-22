import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"
import { generatePolaroidSelfiePrompt } from "@/lib/nightclub/prompts"

export async function POST(request: NextRequest) {
  try {
    const { avatar1Url, avatar2Url } = await request.json()

    if (!avatar1Url || !avatar2Url) {
      return NextResponse.json({ error: "Both avatar URLs are required" }, { status: 400 })
    }

    // Configure fal client inside the handler to ensure env vars are available
    fal.config({
      credentials: process.env.FAL_API_KEY || process.env.FAL_KEY,
    })

    // Generate dynamic selfie-style photo using fal Flux Kontext multi-image
    const prompt = generatePolaroidSelfiePrompt()
    
    // Image size configuration - adjust via FAL_POLAROID_IMAGE_SIZE env var
    // "square_hd" = 512x512 (~$0.013/image), "square" = 1024x1024 (~$0.052/image)
    const imageSize = process.env.FAL_POLAROID_IMAGE_SIZE ?? "square_hd"
    
    console.log("[Polaroid] Generated prompt:", prompt)
    console.log("[Polaroid] Image size:", imageSize)
    
    const result = await fal.subscribe("fal-ai/flux-pro/kontext/multi", {
      input: {
        prompt,
        image_urls: [avatar1Url, avatar2Url],
        image_size: imageSize,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: 5, // Most permissive setting (1-5 scale)
      },
    })

    // Extract the image URL from the result
    // @ts-expect-error - FAL API response shapes are not strongly typed
    const imageUrl = result.images?.[0]?.url

    if (!imageUrl) {
      throw new Error("No image generated")
    }

    // Log cost information (check x-fal-billable-units header for actual cost)
    // FLUX Pro pricing: ~$0.05/megapixel | square_hd (512x512) ≈ $0.013/image
    console.log(`[Polaroid] Cost estimate for ${imageSize}: ~$0.013-0.052 depending on size`)

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("[Polaroid] Error generating polaroid:", error)
    return NextResponse.json({ error: "Failed to generate polaroid" }, { status: 500 })
  }
}
