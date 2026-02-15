import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";

/**
 * Internal mutation for cleaning up duplicate and/or short video records.
 * Invoked via: npx convex run cleanupVideos:cleanup '{"mode":"preview","operation":"duplicates"}'
 *
 * Modes:  "preview" (default) | "execute"
 * Operations: "duplicates" | "short" | "both"
 */
export const cleanup = internalMutation({
  args: {
    mode: v.optional(v.string()), // "preview" (default) | "execute"
    operation: v.string(), // "duplicates" | "short" | "both"
    shortThresholdMinutes: v.optional(v.number()), // default 5
  },
  handler: async (ctx, args) => {
    const mode = args.mode ?? "preview";
    const isExecute = mode === "execute";
    const runDuplicates = args.operation === "duplicates" || args.operation === "both";
    const runShort = args.operation === "short" || args.operation === "both";
    const shortThresholdMinutes = args.shortThresholdMinutes ?? 5;
    const shortThresholdSeconds = shortThresholdMinutes * 60;

    const log: string[] = [];
    const p = (s: string) => log.push(s);
    // Convex truncates console.log at ~8KB. Flush in chunks to avoid losing output.
    const flush = () => {
      if (log.length > 0) {
        console.log(log.join("\n"));
        log.length = 0;
      }
    };

    p("═══════════════════════════════════════════════════════════════");
    p(`  Cleanup Videos — ${isExecute ? "EXECUTE" : "PREVIEW"} MODE`);
    p(`  Operations: ${[runDuplicates && "duplicates", runShort && `short (<${shortThresholdMinutes}m)`].filter(Boolean).join(", ")}`);
    if (!isExecute) {
      p("  ⚠  No data will be changed. Set mode=execute to apply.");
    }
    p("═══════════════════════════════════════════════════════════════");
    p("");

    // Fetch all videos
    const allVideos = await ctx.db.query("videos").collect();
    p(`Fetched ${allVideos.length} total video records.`);
    p("");

    // Build a lookup of videoId → video for cross-referencing
    const videoById = new Map<string, Doc<"videos">>();
    for (const v of allVideos) {
      videoById.set(v._id, v);
    }

    type DeleteCandidate = {
      videoId: Id<"videos">;
      title: string;
      assetId: string | undefined;
      duration: number | undefined;
      linkedLivestreamId: Id<"livestreams"> | undefined;
      reason: string;
      keptVideoId?: Id<"videos">; // for duplicates: the video that will remain
    };
    const toDelete: DeleteCandidate[] = [];

    // ─── Helpers ──────────────────────────────────────────────

    function fmtDur(sec: number | undefined) {
      if (sec == null) return "unknown";
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}m ${s}s`;
    }
    function fmtDate(ts: number | undefined) {
      if (!ts) return "n/a";
      return new Date(ts).toISOString();
    }
    function videoBlock(v: Doc<"videos">, indent = "    ") {
      return [
        `${indent}id:            ${v._id}`,
        `${indent}title:         ${v.title}`,
        `${indent}assetId:       ${v.assetId ?? "none"}`,
        `${indent}status:        ${v.status}`,
        `${indent}duration:      ${fmtDur(v.duration)}`,
        `${indent}playbackId:    ${v.playbackId ?? "none"}`,
        `${indent}visibility:    ${v.visibility}`,
        `${indent}linkedStream:  ${v.linkedLivestreamId ?? "none"}`,
        `${indent}created:       ${fmtDate(v._creationTime)}`,
      ].join("\n");
    }

    flush();

    // ─── Operation 1: Duplicate assetIds ──────────────────────

    if (runDuplicates) {
      p("───────────────────────────────────────────────────────────────");
      p("  DUPLICATE ASSET ID ANALYSIS");
      p("───────────────────────────────────────────────────────────────");
      p("");

      const byAssetId = new Map<string, Doc<"videos">[]>();
      for (const v of allVideos) {
        if (!v.assetId) continue;
        const arr = byAssetId.get(v.assetId) ?? [];
        arr.push(v);
        byAssetId.set(v.assetId, arr);
      }

      const duplicateGroups = Array.from(byAssetId.entries()).filter(([, vids]) => vids.length > 1);

      if (duplicateGroups.length === 0) {
        p("  No duplicate assetIds found. Database is clean.");
        p("");
      } else {
        p(`  Found ${duplicateGroups.length} assetId(s) with duplicate video records:`);
        p("");

        for (const [assetId, vids] of duplicateGroups) {
          // Sort: longer duration first, then earlier creation as tiebreaker
          const sorted = [...vids].sort((a, b) => {
            const durA = a.duration ?? 0;
            const durB = b.duration ?? 0;
            if (durB !== durA) return durB - durA;
            return (a._creationTime ?? 0) - (b._creationTime ?? 0);
          });

          const keep = sorted[0];
          const remove = sorted.slice(1);

          for (const v of remove) {
            p(`  ┌─ DUPLICATE GROUP: assetId ${assetId} (${vids.length} records)`);
            p(`  │`);
            p(`  │  ✗ DELETING:`);
            p(videoBlock(v, "  │    "));
            p(`  │`);

            let reason: string;
            if ((v.duration ?? 0) < (keep.duration ?? 0)) {
              reason = `shorter duration (${fmtDur(v.duration)} vs ${fmtDur(keep.duration)})`;
            } else {
              reason = `same duration but created later (${fmtDate(v._creationTime)} vs ${fmtDate(keep._creationTime)})`;
            }
            p(`  │  reason: ${reason}`);
            p(`  │`);
            p(`  │  ✓ KEEPING INSTEAD:`);
            p(videoBlock(keep, "  │    "));

            // Show linked livestream details for the kept video
            if (keep.linkedLivestreamId) {
              const keepLs = await ctx.db.get(keep.linkedLivestreamId);
              if (keepLs) {
                p(`  │    ↳ linked livestream: "${keepLs.title}" (${keepLs.status}, started ${fmtDate(keepLs.startedAt)})`);
              }
            }

            // Show linked livestream details for the deleted video
            if (v.linkedLivestreamId) {
              const delLs = await ctx.db.get(v.linkedLivestreamId);
              if (delLs) {
                p(`  │`);
                p(`  │  ↳ deleted video's livestream: "${delLs.title}" (${delLs.status}, started ${fmtDate(delLs.startedAt)})`);
                if (delLs.recordingVideoId === v._id) {
                  p(`  │    ⚠ livestream.recordingVideoId points to this video → will be cleared on deletion`);
                } else if (delLs.recordingVideoId) {
                  const pointsTo = videoById.get(delLs.recordingVideoId as string);
                  p(`  │    livestream.recordingVideoId points to ${delLs.recordingVideoId}${pointsTo ? ` ("${pointsTo.title}", ${fmtDur(pointsTo.duration)})` : ""} → no cleanup needed`);
                } else {
                  p(`  │    livestream.recordingVideoId = none → no cleanup needed`);
                }
              }
            }

            p(`  └──────────────────────────────────────────────────────────`);
            p("");

            toDelete.push({
              videoId: v._id,
              title: v.title,
              assetId: v.assetId,
              duration: v.duration,
              linkedLivestreamId: v.linkedLivestreamId,
              reason: `duplicate assetId ${assetId} — ${reason}`,
              keptVideoId: keep._id,
            });
          }
        }
      }
    }

    flush();

    // ─── Operation 2: Short videos ────────────────────────────

    if (runShort) {
      p("───────────────────────────────────────────────────────────────");
      p(`  SHORT VIDEO ANALYSIS (<${shortThresholdMinutes} minutes)`);
      p("───────────────────────────────────────────────────────────────");
      p("");

      const alreadyMarked = new Set(toDelete.map((d) => d.videoId));

      const shortVideos = allVideos.filter((v) => {
        if (alreadyMarked.has(v._id)) return false;
        if (v.duration == null) return false;
        return v.duration < shortThresholdSeconds;
      });

      if (shortVideos.length === 0) {
        p(`  No videos shorter than ${shortThresholdMinutes} minutes found.`);
        p("");
      } else {
        p(`  Found ${shortVideos.length} video(s) shorter than ${shortThresholdMinutes} minutes:`);
        p("");

        for (const v of shortVideos) {
          const reason = `duration ${fmtDur(v.duration)} < ${shortThresholdMinutes}m threshold`;

          p(`  ┌─ SHORT VIDEO`);
          p(`  │`);
          p(`  │  ✗ DELETING:`);
          p(videoBlock(v, "  │    "));
          p(`  │`);
          p(`  │  reason: ${reason}`);

          // Show linked livestream details
          if (v.linkedLivestreamId) {
            const ls = await ctx.db.get(v.linkedLivestreamId);
            if (ls) {
              p(`  │`);
              p(`  │  ↳ linked livestream: "${ls.title}" (${ls.status}, started ${fmtDate(ls.startedAt)})`);
              if (ls.recordingVideoId === v._id) {
                p(`  │    ⚠ livestream.recordingVideoId points to this video → will be cleared on deletion`);
                // Check if there's another video with the same assetId that will remain
                if (v.assetId) {
                  const alternatives = allVideos.filter(
                    (alt) => alt.assetId === v.assetId && alt._id !== v._id && !alreadyMarked.has(alt._id)
                  );
                  if (alternatives.length > 0) {
                    p(`  │    ✓ alternative video exists for same asset:`);
                    for (const alt of alternatives) {
                      p(`  │      → ${alt._id} "${alt.title}" (${fmtDur(alt.duration)}, ${alt.status})`);
                    }
                  } else {
                    p(`  │    ⚠ no alternative video for this asset — livestream will lose its recording link`);
                  }
                }
              } else if (ls.recordingVideoId) {
                const pointsTo = videoById.get(ls.recordingVideoId as string);
                p(`  │    livestream.recordingVideoId → ${ls.recordingVideoId}${pointsTo ? ` ("${pointsTo.title}", ${fmtDur(pointsTo.duration)})` : ""} — no cleanup needed`);
              } else {
                p(`  │    livestream.recordingVideoId = none — no cleanup needed`);
              }
            }
          }

          p(`  └──────────────────────────────────────────────────────────`);
          p("");

          toDelete.push({
            videoId: v._id,
            title: v.title,
            assetId: v.assetId,
            duration: v.duration,
            linkedLivestreamId: v.linkedLivestreamId,
            reason,
          });
        }
      }
    }

    flush();

    // ─── Nothing to delete ────────────────────────────────────

    if (toDelete.length === 0) {
      p("═══════════════════════════════════════════════════════════════");
      p("  Nothing to delete. Database is clean.");
      p("═══════════════════════════════════════════════════════════════");
      flush();
      return { deleted: 0, errors: 0, log };
    }

    // ─── Summary ──────────────────────────────────────────────

    p("═══════════════════════════════════════════════════════════════");
    p(`  SUMMARY — ${isExecute ? "EXECUTE" : "PREVIEW"} MODE`);
    p("═══════════════════════════════════════════════════════════════");
    p("");
    p(`  Total videos in database:  ${allVideos.length}`);
    p(`  Videos to delete:          ${toDelete.length}`);
    p(`  Videos remaining after:    ${allVideos.length - toDelete.length}`);
    p("");

    p("  Deletion list:");
    for (let i = 0; i < toDelete.length; i++) {
      const c = toDelete[i];
      const keptInfo = c.keptVideoId ? ` [keeping ${c.keptVideoId}]` : "";
      p(`    ${i + 1}. "${c.title}"  (${fmtDur(c.duration)})  ${c.videoId}${keptInfo}`);
      p(`       → ${c.reason}`);
    }
    p("");

    flush();

    // ─── Remaining videos ─────────────────────────────────────

    const deleteIds = new Set(toDelete.map((d) => d.videoId));
    const remaining = allVideos.filter((v) => !deleteIds.has(v._id));

    p("───────────────────────────────────────────────────────────────");
    p(`  VIDEOS REMAINING (${remaining.length})`);
    p("───────────────────────────────────────────────────────────────");
    p("");

    for (let ri = 0; ri < remaining.length; ri++) {
      const v = remaining[ri];
      p(`  ┌─ "${v.title}"`);
      p(`  │  id:          ${v._id}`);
      p(`  │  assetId:     ${v.assetId ?? "none"}`);
      p(`  │  status:      ${v.status}`);
      p(`  │  duration:    ${fmtDur(v.duration)}`);
      p(`  │  playbackId:  ${v.playbackId ?? "none"}`);
      p(`  │  visibility:  ${v.visibility}`);
      p(`  │  created:     ${fmtDate(v._creationTime)}`);
      if (v.linkedLivestreamId) {
        const ls = await ctx.db.get(v.linkedLivestreamId);
        if (ls) {
          p(`  │  ↳ linked livestream: "${ls.title}" (${ls.status}, started ${fmtDate(ls.startedAt)})`);
          if (ls.recordingVideoId === v._id) {
            p(`  │    ✓ livestream.recordingVideoId points here`);
          } else if (ls.recordingVideoId) {
            const other = videoById.get(ls.recordingVideoId as string);
            p(`  │    livestream.recordingVideoId → ${ls.recordingVideoId}${other ? ` ("${other.title}")` : ""}`);
          }
        } else {
          p(`  │  linkedStream: ${v.linkedLivestreamId} (not found)`);
        }
      }
      p(`  └──────────────────────────────────────────────────────────`);
      p("");
      // Flush every 5 entries to stay under console.log limits
      if ((ri + 1) % 5 === 0) flush();
    }
    p("");

    // ─── Execute or exit ──────────────────────────────────────

    if (!isExecute) {
      p("  ⚠  PREVIEW MODE — no changes were made.");
      p(`  To apply, re-run with mode=execute`);
      p("");
      flush();
      return { deleted: 0, errors: 0, log };
    }

    p("  EXECUTING DELETIONS...");
    p("");

    let deleted = 0;
    let errors = 0;

    for (const candidate of toDelete) {
      try {
        const video = await ctx.db.get(candidate.videoId);
        if (!video) {
          p(`  ${candidate.videoId} — already gone, skipping`);
          continue;
        }

        // Clear linkedLivestreamId reverse pointer if needed
        if (video.linkedLivestreamId) {
          const ls = await ctx.db.get(video.linkedLivestreamId);
          if (ls && ls.recordingVideoId === candidate.videoId) {
            await ctx.db.patch(video.linkedLivestreamId, {
              recordingVideoId: undefined,
              recordingAssetId: undefined,
              recordingSource: undefined,
              recordingLinkedAt: undefined,
            });
            p(`  ✓ Cleared recordingVideoId on livestream ${video.linkedLivestreamId}`);
          }
        }

        // Delete the video record
        await ctx.db.delete(candidate.videoId);
        p(`  ✓ Deleted ${candidate.videoId} "${candidate.title}"`);
        deleted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        p(`  ✗ Error deleting ${candidate.videoId}: ${msg}`);
        errors++;
      }
    }

    p("");
    p("═══════════════════════════════════════════════════════════════");
    p(`  DONE — Deleted: ${deleted}, Errors: ${errors}`);
    p("═══════════════════════════════════════════════════════════════");

    flush();
    return { deleted, errors, log };
  },
});
