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
export const fix = mutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const linkedVideos = await ctx.db
      .query("videos")
      .withIndex("by_linkedLivestream")
      .filter((q) => q.neq(q.field("linkedLivestreamId"), undefined))
      .collect();

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
