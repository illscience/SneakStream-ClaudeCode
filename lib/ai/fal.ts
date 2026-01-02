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

  // Image size configuration - adjust via FAL_AVATAR_IMAGE_SIZE env var
  // "square_hd" = 512x512 (~$0.013/image), "square" = 1024x1024 (~$0.052/image)
  const defaultImageSize = process.env.FAL_AVATAR_IMAGE_SIZE ?? "square_hd";
  const imageSize = aspectRatio === "1:1" ? defaultImageSize : aspectRatio;

  console.log(`[FAL] Starting image generation with seed: ${seed}, size: ${imageSize}, prompt: ${prompt.substring(0, 50)}...`);

  const result = await fal.subscribe(MODEL_ID, {
    input: {
      prompt,
      image_size: imageSize,
      seed,
      num_inference_steps: 28,
      guidance_scale: 3,
      enable_safety_checker: true,
      safety_tolerance: 2, // Most permissive setting (1-5 scale)
    },
  });

  console.log(`[FAL] Raw response:`, JSON.stringify(result).substring(0, 200));
  
  // Log cost information if available (check x-fal-billable-units for actual cost)
  // FLUX Pro pricing: ~$0.05/megapixel | square_hd (512x512) ≈ $0.013/image
  if (result) {
    console.log(`[FAL] Cost estimate for ${imageSize}: ~$0.013-0.052 depending on size`);
  }

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

export interface GenerateImg2VidOptions {
  imageUrl: string;
  prompt?: string;
  model?: string;
}

export interface GenerateImg2VidResult {
  mediaUrl: string;
  isVideo: boolean;
  raw: unknown;
}

export const generateImg2Vid = async ({
  imageUrl,
  prompt,
  model,
}: GenerateImg2VidOptions): Promise<GenerateImg2VidResult> => {
  ensureConfigured();

  const modelId = model || process.env.FAL_IMG2VID_MODEL || "wan/v2.6/image-to-video";
  const effectivePrompt = prompt ?? "Remix animation";
  const input: Record<string, unknown> = {
    image_url: imageUrl,
    prompt: effectivePrompt,
  };

  console.log(`[FAL] Starting img2vid with model ${modelId}, prompt: ${effectivePrompt.slice(0, 50)}`);

  let result: any;
  try {
    result = await fal.subscribe(modelId, { input, pollInterval: 4000, requestTimeout: 300000 });
  } catch (err: any) {
    const detail =
      err?.body ||
      err?.response?.data ||
      err?.response ||
      err?.message ||
      "Unknown FAL error";
    console.error("[FAL] img2vid error", detail);

    const friendly =
      (typeof detail === "string" && detail) ||
      (detail?.detail?.[0]?.msg as string | undefined) ||
      (detail?.message as string | undefined) ||
      "Img2Vid failed";

    throw new Error(friendly);
  }

  const videoUrl =
    // @ts-expect-error wan response shape
    result?.video?.url ||
    // common fields across fal video models
    // @ts-expect-error untyped
    result?.video_url ||
    // @ts-expect-error alternative nesting
    result?.output?.[0]?.video?.url ||
    // @ts-expect-error alternative nesting
    result?.output?.[0]?.url ||
    // @ts-expect-error legacy
    result?.url;

  const imageUrlOut =
    // @ts-expect-error image outputs
    result?.images?.[0]?.url ||
    // @ts-expect-error alternate nesting
    result?.output?.[0]?.image?.url ||
    (result as any)?.url;

  const mediaUrl = videoUrl || imageUrlOut;
  if (!mediaUrl) {
    console.error("[FAL] Failed to resolve media URL from response", result);
    throw new Error("Failed to resolve media URL from FAL response");
  }

  console.log(`[FAL] Img2Vid generated: ${mediaUrl}`);
  return { mediaUrl, isVideo: !!videoUrl, raw: result };
};
