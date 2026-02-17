import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { logConvexTrace } from "./debugTrace";

type RecordingSource = "webhook" | "end_stream";

const STATUS_PRIORITY: Record<string, number> = {
  uploading: 0,
  processing: 1,
  ready: 2,
};

function normalizeMuxStatus(status?: string) {
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized === "ready") return "ready";
  if (normalized === "preparing" || normalized === "created" || normalized === "processing") {
    return "processing";
  }
  return normalized;
}

function shouldPromoteStatus(existingStatus?: string, incomingStatus?: string) {
  if (!incomingStatus) return false;
  if (!existingStatus) return true;
  return (STATUS_PRIORITY[incomingStatus] ?? 0) > (STATUS_PRIORITY[existingStatus] ?? 0);
}

function getPlaybackUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
}

export type UpsertMuxRecordingArgs = {
  assetId: string;
  userId: string;
  uploadedBy?: string;
  title: string;
  description?: string;
  playbackId?: string;
  duration?: number;
  status?: string;
  visibility?: string;
  liveStreamId?: string;
  linkedLivestreamId?: Id<"livestreams">;
  traceId?: string;
  source: RecordingSource;
};

export type UpsertMuxRecordingResult = {
  videoId: Id<"videos">;
  action: "inserted" | "updated" | "unchanged";
  linkStatus: "not_requested" | "linked" | "already_linked" | "link_conflict" | "stream_not_found";
};

async function linkLivestreamToRecording(
  ctx: MutationCtx,
  args: {
    livestreamId: Id<"livestreams">;
    videoId: Id<"videos">;
    assetId: string;
    source: RecordingSource;
    traceId?: string;
  }
): Promise<UpsertMuxRecordingResult["linkStatus"]> {
  const stream = await ctx.db.get(args.livestreamId);
  if (!stream) {
    logConvexTrace("recording.link_livestream_stream_missing", {
      traceId: args.traceId,
      livestreamId: args.livestreamId,
      videoId: args.videoId,
      assetId: args.assetId,
      source: args.source,
    });
    return "stream_not_found";
  }

  logConvexTrace("recording.link_livestream_entry", {
    traceId: args.traceId,
    source: args.source,
    livestreamId: args.livestreamId,
    videoId: args.videoId,
    assetId: args.assetId,
    streamStatus: stream.status,
    streamTitle: stream.title,
    currentRecordingVideoId: stream.recordingVideoId ?? null,
    currentRecordingAssetId: stream.recordingAssetId ?? null,
    currentRecordingSource: stream.recordingSource ?? null,
    currentRecordingLinkedAt: stream.recordingLinkedAt ?? null,
  });

  if (stream.recordingVideoId && stream.recordingVideoId !== args.videoId) {
    if (args.source === "end_stream") {
      // end-stream is authoritative — it passes the exact Convex livestream ID.
      // Clear stale linkedLivestreamId on the old video if it points here.
      logConvexTrace("recording.link_livestream_override_video", {
        traceId: args.traceId,
        livestreamId: args.livestreamId,
        oldRecordingVideoId: stream.recordingVideoId,
        newRecordingVideoId: args.videoId,
        source: args.source,
      });
      const oldVideo = await ctx.db.get(stream.recordingVideoId);
      if (oldVideo && oldVideo.linkedLivestreamId === args.livestreamId) {
        await ctx.db.patch(stream.recordingVideoId, {
          linkedLivestreamId: undefined,
        });
        logConvexTrace("recording.link_livestream_old_video_cleared", {
          traceId: args.traceId,
          oldVideoId: stream.recordingVideoId,
          clearedLinkedLivestreamId: args.livestreamId,
        });
      }
    } else {
      logConvexTrace("recording.link_livestream_video_conflict", {
        traceId: args.traceId,
        livestreamId: args.livestreamId,
        existingRecordingVideoId: stream.recordingVideoId,
        attemptedRecordingVideoId: args.videoId,
        existingRecordingAssetId: stream.recordingAssetId,
        attemptedRecordingAssetId: args.assetId,
        source: args.source,
      });
      return "link_conflict";
    }
  }

  if (
    stream.recordingAssetId &&
    stream.recordingAssetId !== args.assetId &&
    stream.recordingVideoId &&
    stream.recordingVideoId === args.videoId
  ) {
    if (args.source !== "end_stream") {
      logConvexTrace("recording.link_livestream_asset_conflict", {
        traceId: args.traceId,
        livestreamId: args.livestreamId,
        existingRecordingAssetId: stream.recordingAssetId,
        attemptedRecordingAssetId: args.assetId,
        source: args.source,
      });
      return "link_conflict";
    }
    logConvexTrace("recording.link_livestream_asset_override", {
      traceId: args.traceId,
      livestreamId: args.livestreamId,
      oldRecordingAssetId: stream.recordingAssetId,
      newRecordingAssetId: args.assetId,
      source: args.source,
    });
    // end_stream: fall through to overwrite with authoritative data
  }

  const updates: Partial<{
    recordingVideoId: Id<"videos">;
    recordingAssetId: string;
    recordingSource: RecordingSource;
    recordingLinkedAt: number;
  }> = {};

  if (args.source === "end_stream") {
    // end-stream is authoritative — always set all link fields
    updates.recordingVideoId = args.videoId;
    updates.recordingAssetId = args.assetId;
    updates.recordingSource = args.source;
    updates.recordingLinkedAt = Date.now();
  } else {
    if (!stream.recordingVideoId) {
      updates.recordingVideoId = args.videoId;
    }
    if (!stream.recordingAssetId) {
      updates.recordingAssetId = args.assetId;
    }
    if (!stream.recordingSource) {
      updates.recordingSource = args.source;
    }
    if (!stream.recordingLinkedAt) {
      updates.recordingLinkedAt = Date.now();
    }
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(args.livestreamId, updates);
    logConvexTrace("recording.link_livestream_success", {
      traceId: args.traceId,
      source: args.source,
      livestreamId: args.livestreamId,
      videoId: args.videoId,
      assetId: args.assetId,
      updatedFields: Object.keys(updates),
    });
    return "linked";
  }

  logConvexTrace("recording.link_livestream_already_linked", {
    traceId: args.traceId,
    source: args.source,
    livestreamId: args.livestreamId,
    videoId: args.videoId,
    assetId: args.assetId,
  });
  return "already_linked";
}

export async function upsertMuxRecording(
  ctx: MutationCtx,
  args: UpsertMuxRecordingArgs
): Promise<UpsertMuxRecordingResult> {
  const normalizedStatus = normalizeMuxStatus(args.status) ?? "processing";

  logConvexTrace("recording.upsert_entry", {
    traceId: args.traceId,
    source: args.source,
    assetId: args.assetId,
    incomingStatus: args.status,
    normalizedStatus,
    playbackId: args.playbackId,
    duration: args.duration,
    linkedLivestreamId: args.linkedLivestreamId ?? null,
    liveStreamId: args.liveStreamId ?? null,
    title: args.title,
  });

  let existing = await ctx.db
    .query("videos")
    .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
    .order("desc")
    .first();

  if (existing) {
    logConvexTrace("recording.upsert_found_existing", {
      traceId: args.traceId,
      source: args.source,
      assetId: args.assetId,
      existingVideoId: existing._id,
      existingStatus: existing.status,
      existingPlaybackId: existing.playbackId ?? null,
      existingDuration: existing.duration ?? null,
      existingLinkedLivestreamId: existing.linkedLivestreamId ?? null,
      existingProvider: existing.provider ?? null,
    });

    const updates: Record<string, unknown> = {};
    const incomingPlaybackUrl = getPlaybackUrl(args.playbackId);

    if (args.title && args.source === "end_stream" && existing.title !== args.title) {
      updates.title = args.title;
    }
    if (
      args.description !== undefined &&
      args.source === "end_stream" &&
      existing.description !== args.description
    ) {
      updates.description = args.description;
    }

    if (args.playbackId) {
      if (!existing.playbackId) {
        updates.playbackId = args.playbackId;
        updates.playbackUrl = incomingPlaybackUrl;
      } else if (existing.playbackId === args.playbackId && existing.playbackUrl !== incomingPlaybackUrl) {
        updates.playbackUrl = incomingPlaybackUrl;
      } else if (existing.playbackId !== args.playbackId) {
        logConvexTrace("recording.playback_conflict", {
          traceId: args.traceId,
          assetId: args.assetId,
          existingVideoId: existing._id,
          existingPlaybackId: existing.playbackId,
          incomingPlaybackId: args.playbackId,
          source: args.source,
        });
      }
    }

    if (
      args.duration !== undefined &&
      (existing.duration === undefined || args.duration > existing.duration)
    ) {
      updates.duration = args.duration;
    }

    const statusPromoted = shouldPromoteStatus(existing.status, normalizedStatus);
    if (statusPromoted) {
      updates.status = normalizedStatus;
    }
    logConvexTrace("recording.upsert_status_check", {
      traceId: args.traceId,
      assetId: args.assetId,
      existingStatus: existing.status,
      incomingStatus: normalizedStatus,
      promoted: statusPromoted,
    });

    if (args.visibility && args.visibility !== existing.visibility) {
      updates.visibility = args.visibility;
    }
    if (args.uploadedBy && !existing.uploadedBy) {
      updates.uploadedBy = args.uploadedBy;
    }
    if (existing.provider !== "mux") {
      updates.provider = "mux";
    }

    let linkStatus: UpsertMuxRecordingResult["linkStatus"] = "not_requested";
    if (args.linkedLivestreamId) {
      if (!existing.linkedLivestreamId) {
        updates.linkedLivestreamId = args.linkedLivestreamId;
        logConvexTrace("recording.upsert_video_link_set", {
          traceId: args.traceId,
          assetId: args.assetId,
          videoId: existing._id,
          linkedLivestreamId: args.linkedLivestreamId,
          source: args.source,
        });
      } else if (existing.linkedLivestreamId !== args.linkedLivestreamId) {
        if (args.source === "end_stream") {
          // end-stream is authoritative — overwrite the webhook's earlier link.
          const oldLivestreamId = existing.linkedLivestreamId;
          updates.linkedLivestreamId = args.linkedLivestreamId;
          logConvexTrace("recording.video_link_override", {
            traceId: args.traceId,
            assetId: args.assetId,
            videoId: existing._id,
            oldLinkedLivestreamId: oldLivestreamId,
            newLinkedLivestreamId: args.linkedLivestreamId,
            source: args.source,
          });
          // Clear stale recording fields on the old livestream
          const oldStream = await ctx.db.get(oldLivestreamId);
          if (oldStream && oldStream.recordingVideoId === existing._id) {
            await ctx.db.patch(oldLivestreamId, {
              recordingVideoId: undefined,
              recordingAssetId: undefined,
              recordingSource: undefined,
              recordingLinkedAt: undefined,
            });
            logConvexTrace("recording.old_livestream_link_cleared", {
              traceId: args.traceId,
              oldLivestreamId,
              videoId: existing._id,
              assetId: args.assetId,
            });
          } else {
            logConvexTrace("recording.old_livestream_link_skip", {
              traceId: args.traceId,
              oldLivestreamId,
              videoId: existing._id,
              oldStreamRecordingVideoId: oldStream?.recordingVideoId ?? null,
              reason: !oldStream ? "stream_not_found" : "recording_points_elsewhere",
            });
          }
        } else {
          linkStatus = "link_conflict";
          logConvexTrace("recording.video_link_conflict", {
            traceId: args.traceId,
            assetId: args.assetId,
            videoId: existing._id,
            existingLinkedLivestreamId: existing.linkedLivestreamId,
            incomingLinkedLivestreamId: args.linkedLivestreamId,
            source: args.source,
          });
        }
      } else {
        logConvexTrace("recording.upsert_video_link_unchanged", {
          traceId: args.traceId,
          assetId: args.assetId,
          videoId: existing._id,
          linkedLivestreamId: existing.linkedLivestreamId,
          source: args.source,
        });
      }
    }

    if (Object.keys(updates).length > 0) {
      logConvexTrace("recording.upsert_patching", {
        traceId: args.traceId,
        assetId: args.assetId,
        videoId: existing._id,
        updatedFields: Object.keys(updates),
        source: args.source,
      });
      await ctx.db.patch(existing._id, updates);
      existing = {
        ...existing,
        ...updates,
      };
    }

    if (args.linkedLivestreamId && linkStatus !== "link_conflict") {
      linkStatus = await linkLivestreamToRecording(ctx, {
        livestreamId: args.linkedLivestreamId,
        videoId: existing._id,
        assetId: args.assetId,
        source: args.source,
        traceId: args.traceId,
      });
    }

    const action = Object.keys(updates).length > 0 ? "updated" : "unchanged";
    logConvexTrace("recording.upsert_result", {
      traceId: args.traceId,
      source: args.source,
      assetId: args.assetId,
      videoId: existing._id,
      action,
      linkStatus,
      finalStatus: existing.status,
      finalLinkedLivestreamId: existing.linkedLivestreamId ?? null,
      finalPlaybackId: existing.playbackId ?? null,
    });

    return {
      videoId: existing._id,
      action: action as "updated" | "unchanged",
      linkStatus,
    };
  }

  logConvexTrace("recording.upsert_no_existing", {
    traceId: args.traceId,
    source: args.source,
    assetId: args.assetId,
    normalizedStatus,
    linkedLivestreamId: args.linkedLivestreamId ?? null,
    title: args.title,
  });

  const playbackUrl = getPlaybackUrl(args.playbackId);
  const newVideoId = await ctx.db.insert("videos", {
    userId: args.userId,
    uploadedBy: args.uploadedBy,
    title: args.title,
    description: args.description,
    provider: "mux",
    assetId: args.assetId,
    playbackId: args.playbackId,
    playbackUrl,
    duration: args.duration,
    status: normalizedStatus,
    visibility: args.visibility || "public",
    viewCount: 0,
    heartCount: 0,
    ...(args.linkedLivestreamId ? { linkedLivestreamId: args.linkedLivestreamId } : {}),
  });

  logConvexTrace("recording.upsert_inserted", {
    traceId: args.traceId,
    source: args.source,
    assetId: args.assetId,
    videoId: newVideoId,
    status: normalizedStatus,
    playbackId: args.playbackId ?? null,
    linkedLivestreamId: args.linkedLivestreamId ?? null,
  });

  let linkStatus: UpsertMuxRecordingResult["linkStatus"] = "not_requested";
  if (args.linkedLivestreamId) {
    linkStatus = await linkLivestreamToRecording(ctx, {
      livestreamId: args.linkedLivestreamId,
      videoId: newVideoId,
      assetId: args.assetId,
      source: args.source,
      traceId: args.traceId,
    });
  }

  logConvexTrace("recording.upsert_insert_result", {
    traceId: args.traceId,
    source: args.source,
    assetId: args.assetId,
    videoId: newVideoId,
    linkStatus,
    status: normalizedStatus,
  });

  return {
    videoId: newVideoId,
    action: "inserted",
    linkStatus,
  };
}
