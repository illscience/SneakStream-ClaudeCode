# Mux / Convex State Diagrams

Reference state machines for the three core objects in the streaming pipeline plus the cross-object recording ingest flow.

## 1. Mux Live Stream States

The Mux-side lifecycle observed through webhooks.

```mermaid
stateDiagram-v2
    idle --> active : Streamer connects (RTMP)
    active --> idle : Streamer disconnects\n(within reconnect window)
    active --> disabled : disableLiveStream()\nfrom /api/stream/end

    note right of active
        Webhook: video.live_stream.active
        fires on idle → active
    end note
```

**Key files:** `lib/mux.ts` (`disableLiveStream`), `app/api/stream/end/route.ts`, `app/api/webhooks/mux/route.ts` (`video.live_stream.active` handler)

---

## 2. Convex Livestream States (`livestreams` table)

```mermaid
stateDiagram-v2
    [*] --> active : startStream() mutation\n(ends any prior active stream)

    active --> active : webhook updates startedAt\n(updateStreamStartedAt, first time only)
    active --> active : title / price edits,\nviewer count updates

    active --> ended : endStream() mutation
    active --> ended : new startStream()\nimplicitly ends prior

    state ended {
        direction LR
        [*] --> unlinked : endStream() with no assetId
        [*] --> linked : endStream() with assetId\nor webhook links recording
        unlinked --> linked : late webhook\nlinks recording
    }
```

**Fields set on link:** `recordingVideoId`, `recordingAssetId`, `recordingSource` (`"webhook"` | `"end_stream"`), `recordingLinkedAt`

**Key files:** `convex/livestream.ts` (`startStream`, `endStream`, `updateStreamStartedAt`), `convex/recordingIngest.ts` (`linkLivestreamToRecording`)

---

## 3. Convex Video States (`videos` table)

Two parallel state tracks managed independently.

### 3a. Primary Status

```mermaid
stateDiagram-v2
    [*] --> processing : createVideo() or\nupsertMuxRecording(status != ready)
    [*] --> ready : upsertMuxRecording()\nwhen asset already ready

    processing --> ready : webhook video.asset.ready\nor video.asset.live_stream_completed\nvia upsertMuxRecording()
    processing --> failed : manual admin action

    note right of ready
        Status promotion only moves forward:
        shouldPromoteStatus() blocks
        ready → processing regression
    end note
```

**Status priority:** `uploading (0)` < `processing (1)` < `ready (2)` — see `STATUS_PRIORITY` in `convex/recordingIngest.ts`

**Normalization:** Mux statuses `"preparing"`, `"created"` are mapped to `"processing"` by `normalizeMuxStatus()`

### 3b. Master Download Status (`masterStatus`)

```mermaid
stateDiagram-v2
    [*] --> preparing : requestMasterDownload()\n(admin action)

    preparing --> ready : webhook video.asset.master.ready\n(sets masterUrl + 24h expiry)
    preparing --> [*] : webhook video.asset.master.errored\n(clearMasterByAssetId)

    ready --> [*] : clearExpiredMasters()\nor webhook master.deleted / master.errored
```

**Fields:** `masterStatus` (`"preparing"` | `"ready"` | `undefined`), `masterUrl`, `masterExpiresAt` (24h TTL)

**Key files:** `convex/videos.ts` (`requestMasterDownload`, `updateMasterStatusByAssetId`, `clearMasterByAssetId`, `clearExpiredMasters`), `app/api/webhooks/mux/route.ts` (master event handlers)

---

## 4. Recording Ingest Flow (cross-object)

How a Mux asset event flows through the system and links to Convex objects.

```mermaid
stateDiagram-v2
    state "Mux Webhook" as mux {
        [*] --> asset_created : video.asset.created
        [*] --> asset_ready : video.asset.ready\nor live_stream_completed
    }

    state "Candidate Tracking" as candidate {
        recorded : recordingCandidate\n(reason: waiting_for_ready)
    }

    state "Livestream Lookup" as lookup {
        match : getStreamByStreamId()\nstreamId + timing window
        no_match : recordingCandidate\n(reason: not_found / no_stream_id)
    }

    state "Convex Upsert" as upsert {
        video : upsertMuxRecording()\ninsert or update Video
        link : linkLivestreamToRecording()\nsets recordingVideoId on Livestream
    }

    asset_created --> recorded : defer (do not upsert yet)

    asset_ready --> match : liveStreamId present
    asset_ready --> no_match : no liveStreamId

    match --> video : stream found
    match --> no_match : no confident match

    video --> link : linkedLivestreamId provided
```

### Parallel Ingest Paths

Both paths use `upsertMuxRecording()` which is idempotent by `assetId`:

| Path | Trigger | Source field |
|------|---------|-------------|
| **Webhook** | `video.asset.ready` or `live_stream_completed` | `source: "webhook"` |
| **End-stream API** | `/api/stream/end` polls Mux, passes asset to `endStream()` | `source: "end_stream"` |

Whichever arrives first creates the video row; the second updates it without duplicating.

**Key files:** `convex/recordingIngest.ts` (`upsertMuxRecording`, `linkLivestreamToRecording`), `app/api/webhooks/mux/route.ts` (`upsertMuxAsset`), `app/api/stream/end/route.ts` (`fetchRecordingAsset`), `convex/livestream.ts` (`endStream`)
