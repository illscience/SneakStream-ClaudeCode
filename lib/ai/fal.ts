import * as fal from "@fal-ai/serverless-client";

const MODEL_ID = process.env.FAL_AVATAR_MODEL_ID ?? "fal-ai/flux-pro/v1.1";

const ensureConfigured = () => {
  const key = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (!key) {
    throw new Error("FAL_API_KEY is not set");
  }

  // Configure on every call to ensure API key is set
  fal.config({ credentials: key });
};

export interface GenerateAvatarImageOptions {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9";
  seed?: number;
}

export interface GenerateAvatarImageResult {
  imageUrl: string;
  raw: unknown;
}

export const generateAvatarImage = async ({
  prompt,
  aspectRatio = "1:1",
  seed,
}: GenerateAvatarImageOptions): Promise<GenerateAvatarImageResult> => {
  ensureConfigured();

  console.log(`[FAL] Starting image generation with seed: ${seed}, prompt: ${prompt.substring(0, 50)}...`);

  const result = await fal.subscribe(MODEL_ID, {
    input: {
      prompt,
      image_size: aspectRatio === "1:1" ? "square" : aspectRatio,
      seed,
      num_inference_steps: 28,
      guidance_scale: 3,
      enable_safety_checker: true,
      safety_tolerance: 5, // Most permissive setting (1-5 scale)
    },
  });

  console.log(`[FAL] Raw response:`, JSON.stringify(result).substring(0, 200));

  const image =
    // @ts-expect-error - API response shapes are not strongly typed
    result?.images?.[0]?.url ??
    // @ts-expect-error - Some deployments nest output under `output`
    result?.output?.[0]?.image?.url ??
    // @ts-expect-error - Legacy format under `image_url`
    result?.image_url ??
    // @ts-expect-error - Nested data wrapper
    result?.data?.images?.[0]?.url ??
    // @ts-expect-error - Alternate nesting for batched responses
    result?.data?.output?.[0]?.image?.url ??
    // @ts-expect-error - Some models return a flat `url`
    result?.url;

  if (!image) {
    console.error(`[FAL] Failed to resolve image URL from response`, result);
    throw new Error("Failed to resolve image URL from FAL response");
  }

  console.log(`[FAL] Successfully generated image: ${image}`);
  return { imageUrl: image as string, raw: result };
};
