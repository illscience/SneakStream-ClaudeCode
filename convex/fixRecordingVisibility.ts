import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./adminSettings";

/**
 * One-time migration: patch recordings that inherited "public" visibility
 * from the old hardcoded default, when their source livestream was PPV.
 *
 * Run with: npx convex run fixRecordingVisibility:fix '{"dryRun": true}'
 * Then:     npx convex run fixRecordingVisibility:fix '{"dryRun": false}'
 *
 * Safe to delete this file after the migration is complete.
 */
/** Dev-only: patch a single video's visibility + price. Remove after migration. */
export const patchVideo = mutation({
  args: {
    videoId: v.id("videos"),
    visibility: v.string(),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { visibility: args.visibility };
    if (args.price !== undefined) patch.price = args.price;
    await ctx.db.patch(args.videoId, patch);
    return { patched: args.videoId };
  },
});

export const fix = mutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const videos = await ctx.db.query("videos").collect();
    const linkedVideos = videos.filter((v) => v.linkedLivestreamId);

    const results: Array<{
      videoId: string;
      title: string;
      linkedLivestreamId: string;
      oldVisibility: string;
      newVisibility: string;
      newPrice?: number;
      patched: boolean;
    }> = [];

    for (const video of linkedVideos) {
      const stream = await ctx.db.get(video.linkedLivestreamId!);
      if (!stream) continue;

      const streamVis = stream.visibility || "public";
      const needsVisUpdate = streamVis !== video.visibility;
      const needsPriceUpdate =
        stream.price !== undefined && stream.price !== video.price;

      if (!needsVisUpdate && !needsPriceUpdate) continue;

      const entry = {
        videoId: video._id,
        title: video.title,
        linkedLivestreamId: video.linkedLivestreamId!,
        oldVisibility: video.visibility,
        newVisibility: streamVis,
        newPrice: stream.price,
        patched: false,
      };

      if (!args.dryRun) {
        const patch: Record<string, unknown> = {};
        if (needsVisUpdate) patch.visibility = streamVis;
        if (needsPriceUpdate) patch.price = stream.price;
        await ctx.db.patch(video._id, patch);
        entry.patched = true;
      }

      results.push(entry);
    }

    return {
      dryRun: args.dryRun,
      totalLinkedVideos: linkedVideos.length,
      videosNeedingUpdate: results.length,
      results,
    };
  },
});
