# DJ Sneak - Live Streaming Platform

A Next.js-based live streaming platform for DJ Sneak, featuring live streams, video on demand, and event discovery.

## Features

- 🎵 Live DJ streaming
- 📹 Video upload and library management
- ⭐ Default video playback when offline
- 💬 Real-time chat
- 🎟️ Event discovery powered by AI
- 👥 User profiles and following
- 🔐 Authentication with Clerk

## Tech Stack

- **Framework:** Next.js 15 with Turbopack
- **Video Infrastructure:** Livepeer Studio
- **Database:** Convex
- **Authentication:** Clerk
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
NEXT_PUBLIC_STREAM_PROVIDER=
CLAUDE_API_KEY=
FAL_API_KEY=
FAL_AVATAR_MODEL_ID= # optional override, defaults to fal-ai/flux-pro/v1.1
FAL_AVATAR_IMAGE_SIZE= # optional, defaults to square_hd (512x512, ~$0.013/image). Use "square" for 1024x1024 (~$0.052/image)
FAL_POLAROID_IMAGE_SIZE= # optional, defaults to square_hd (512x512). Use "square" for higher quality
OPENROUTER_API_KEY=
OPENROUTER_KIMI_MODEL= # optional override, defaults to moonshot/kimi-k2
OPENROUTER_HTTP_REFERER= # optional, identifies your app in OpenRouter logs
OPENROUTER_APP_TITLE= # optional, shown in OpenRouter dashboard
DEBUG_DUPLICATE_ASSET_TRACE= # optional, set to 1 for duplicate-asset trace logs (server + Convex)
NEXT_PUBLIC_DEBUG_DUPLICATE_ASSET_TRACE= # optional, set to 1 for duplicate-asset trace logs in the browser
```

Set `NEXT_PUBLIC_STREAM_PROVIDER=mux` to enable the Mux-specific frontend experience; leave it empty or set to `livepeer` to keep the original Livepeer flow. To run the live Mux verification suite, export `MUX_LIVE_TEST=1` (with valid `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`) before executing `npm run test`. Otherwise the live tests are skipped automatically.

## Dev Runbook: Duplicate `assetId` Reproduction

Use this when investigating duplicate Mux asset records with production-fidelity behavior.

### 1. Enable trace logging

Set these in your local env:

```bash
DEBUG_DUPLICATE_ASSET_TRACE=1
NEXT_PUBLIC_DEBUG_DUPLICATE_ASSET_TRACE=1
```

Trace logs emit as one-line JSON prefixed with `[dup-trace]` from:
- browser end-stream flow
- `/api/stream/end`
- `/api/webhooks/mux`
- Convex `livestream.endStream`
- Convex `videos.upsertMuxAsset` / `videos.createVideo`
- Next.js server startup (`event: next-server-startup`)

With debug enabled, you should see one startup diagnostic in the `npm run dev` terminal:

```text
[dup-trace] {"service":"next-server","event":"next-server-startup",...}
```

### 2. Start local services

```bash
npm run dev
npx convex dev
```

### 3. Expose your local app via tunnel

Use a tunnel (for example, ngrok or cloudflared) that forwards to `http://localhost:3000`.

### 4. Point Mux webhook to your tunnel

Configure Mux webhook endpoint to:

```text
https://<your-tunnel-host>/api/webhooks/mux
```

Use your local `MUX_WEBHOOK_SECRET` for signature verification.

### 5. Reproduce with normal stream flow

1. Start a Mux livestream from the app.
2. End the stream from the app normally.
3. If needed, repeat realistic retry actions (for example network retry/reload timing) while keeping flow natural.

### 6. Correlate evidence

Filter logs for `[dup-trace]`, then group by `assetId` and `traceId`.

Expected duplicate evidence:
- both `livestream.endStream` insert path and `videos.upsertMuxAsset` insert path for the same `assetId`, or
- multiple insert branches from the same writer path for one `assetId`.

### 7. Inspect duplicate groups safely

Use Convex query `videos.getDuplicateAssetGroups` (admin-only) to inspect duplicate clusters by `assetId` with per-row metadata (`_id`, `_creationTime`, `duration`, `status`, `linkedLivestreamId`, `uploadedBy`, `playbackId`).

## Auth Environment Matrix (Clerk + Convex)

Auth succeeds only when the Clerk token issuer matches what the target Convex deployment trusts.

### Local development (`localhost`)

- Next.js app uses Clerk **test** keys (issuer: `https://adjusted-arachnid-92.clerk.accounts.dev`)
- Convex target is dev deployment: `dev:colorful-ant-503`
- Convex dev env must include:
  - `CLERK_JWT_ISSUER_DOMAIN=https://adjusted-arachnid-92.clerk.accounts.dev`
- Clerk test instance must have JWT template:
  - name: `convex`
  - audience (`aud`): `convex`

Set and verify on Convex dev:

```bash
CONVEX_DEPLOYMENT=dev:colorful-ant-503 npx convex env set CLERK_JWT_ISSUER_DOMAIN https://adjusted-arachnid-92.clerk.accounts.dev
CONVEX_DEPLOYMENT=dev:colorful-ant-503 npx convex env get CLERK_JWT_ISSUER_DOMAIN
```

### Production

- Domain: `sneakstream.xyz` (or subdomains)
- Clerk issuer: `https://clerk.sneakstream.xyz`
- Convex production deployment must trust:
  - `CLERK_JWT_ISSUER_DOMAIN=https://clerk.sneakstream.xyz`

### Common auth errors and what they mean

- `Clerk: Production Keys are only allowed for domain "sneakstream.xyz"`:
  local app is using production Clerk keys on localhost.
- `No auth provider found matching the given token ... OIDC(domain=..., app_id=convex)`:
  Convex trusts a different issuer than the token's `iss` claim.
- `Uncaught Error: Not authenticated` in Convex mutations (for example `users:upsertUser`):
  usually a follow-on failure from issuer mismatch above.

### After changing auth env/config

1. Restart `npx convex dev`
2. Restart `npm run dev`
3. Sign out and sign back in to mint a fresh Clerk token

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com).

Don't forget to set your environment variables in the Vercel dashboard!
