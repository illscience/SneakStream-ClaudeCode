# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DJ Sneak is a Next.js 15-based live streaming platform featuring live DJ streams, video on demand, real-time chat, AI-powered event discovery, and an interactive nightclub experience. The stack includes Livepeer/Mux for video infrastructure, Convex for real-time backend, Clerk for authentication, and Tailwind CSS for styling.

## Development Commands

**Setup:**
```bash
npm install                    # Install dependencies
```

**Development:**
```bash
npm run dev                    # Start Next.js dev server with Turbopack (port 3000)
npx convex codegen             # Regenerate TypeScript types after schema changes
```

**IMPORTANT: This project uses Convex Cloud (hosted backend). Do NOT run `npx convex dev` - the Convex backend is managed in the cloud and will auto-deploy schema changes. Only use `npx convex codegen` to regenerate TypeScript types locally.**

**Production:**
```bash
npm run build                  # Build for production with Turbopack
npm start                      # Start production server
```

**Code Quality:**
```bash
npm run lint                   # Run ESLint (required before PRs)
```

**Utilities:**
```bash
node scripts/make-admin.js     # Grant admin privileges (idempotent)
```

## Architecture

### Directory Structure
- `app/` - Next.js 15 App Router pages with colocated layouts and loading states
  - Routes: `/` (home), `/watch/[videoId]`, `/go-live`, `/upload`, `/library`, `/feed`, `/profile`, `/admin`, `/nightclub`, `/playlist`, `/chat`, `/design`
  - `app/api/` - API routes for video operations, streaming, nightclub, events search, webhooks
  - `app/components/` - UI components used within app routes
- `components/` - Shared UI components (kebab-case files)
- `lib/` - Cross-cutting utilities, hooks, and client setup
  - `streamProvider.ts` - Mux/Livepeer provider selection logic
  - `mux.ts` / `livepeer.ts` - Provider-specific implementations
- `convex/` - Real-time backend functions and schema
  - `schema.ts` - Database schema with tables: messages, users, follows, videos, events, livestreams, playbackState, streamCredentials, nightclubAvatars, nightclubEncounters, avatarPool, adminSettings, playlist
  - Backend modules: `chat.ts`, `videos.ts`, `livestream.ts`, `events.ts`, `follows.ts`, `users.ts`, `playbackState.ts`, `playlist.ts`, `streamCredentials.ts`, `nightclub.ts`, `avatarQueue.ts`, `adminSettings.ts`, `remix.ts`
- `public/` - Static assets
- `scripts/` - Operational scripts (must remain idempotent)

### Video Infrastructure
The platform supports **dual video providers** (Mux and Livepeer):
- Provider selection controlled by environment variables (see `lib/streamProvider.ts`)
- Set `NEXT_PUBLIC_STREAM_PROVIDER=mux` to enable Mux frontend experience
- Defaults to Mux if credentials are present; falls back to Livepeer if explicitly set
- Video metadata stored in Convex `videos` table with provider-specific fields (`assetId`, `livepeerAssetId`, `playbackId`)
- Streaming: Persistent stream credentials stored in `streamCredentials` table per user
- Recordings: Mux stream recordings are automatically imported as VOD videos via `/api/stream/sync-recordings`
- Webhooks: Mux asset events processed at `/api/webhooks/mux`

### Real-time Features
- **Convex Cloud** (hosted backend) powers real-time chat, video updates, follower counts, synchronized playback, and nightclub interactions
- After modifying `convex/schema.ts`, always run `npx convex codegen` to regenerate types
- Schema changes auto-deploy to Convex Cloud - no local Convex server needed

### Authentication & Authorization
- **Clerk** handles user authentication
- Middleware at `middleware.ts` protects routes (public: `/`, nightclub APIs, webhooks)
- User data synchronized with Convex via `users` table
- Admin privileges managed via `scripts/make-admin.js`

### AI Features
- **Event Discovery**: Claude API powers event search at `/api/events/search`
- **Nightclub Avatars**: AI-generated avatars using fal.ai (`FAL_API_KEY`, `FAL_AVATAR_MODEL_ID`)
- **Conversations**: AI-powered interactions using OpenRouter Kimi model (`OPENROUTER_API_KEY`, `OPENROUTER_KIMI_MODEL`)
- **Video Remix**: First/last frame video remix with Google Veo 3.1 model (see `convex/remix.ts`)

### Nightclub Feature
Interactive nightclub experience with:
- AI-generated avatar pool (pre-generated for instant loading at `/api/nightclub/queue`)
- Real-time avatar spawning and movement (tracked in `nightclubAvatars` table)
- AI-powered conversations between avatars (`nightclubEncounters` table)
- Polaroid generation for avatar encounters
- Admin toggle via `adminSettings` table (key: `showNightclubOnHome`)

### Playlist & Playback
- Broadcast-style video playback queue in `playlist` table
- Synchronized playback state in `playbackState` table
- Admin controls for queue management at `/admin`

## Coding Conventions

**Language & Framework:**
- TypeScript only
- Default to React Server Components in `app/`
- Use `"use client"` directive only when state or browser APIs required

**Styling:**
- Tailwind utility-first approach
- No new global CSS

**Naming:**
- camelCase: variables, functions
- PascalCase: components
- kebab-case: component files in `components/`

**Import Order:**
1. External packages
2. Internal aliases
3. Relative paths

**Code Style:**
- Prefer async/await
- Descriptive prop names (no abbreviations)

## Testing

- Test framework: Vitest
- Place tests next to features: `app/watch/__tests__/player.test.tsx`
- Mirror component names in test files
- Mock Convex calls for deterministic tests
- Set `MUX_LIVE_TEST=1` to run live Mux verification suite (requires valid `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`)

## Environment Variables

Required in `.env.local`:
```
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Backend
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=

# Video Infrastructure
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
NEXT_PUBLIC_STREAM_PROVIDER=     # "mux" or "livepeer" (defaults to mux if credentials present)

# AI Features
CLAUDE_API_KEY=                   # For AI event discovery
FAL_API_KEY=                      # For avatar generation
FAL_AVATAR_MODEL_ID=              # Optional override, defaults to fal-ai/flux-pro/v1.1
FAL_AVATAR_IMAGE_SIZE=            # Optional, defaults to square_hd (512x512, ~$0.013/image). Use "square" for 1024x1024 (~$0.052/image)
FAL_POLAROID_IMAGE_SIZE=          # Optional, defaults to square_hd (512x512). Use "square" for higher quality
OPENROUTER_API_KEY=               # For AI conversations
OPENROUTER_KIMI_MODEL=            # Optional override, defaults to moonshot/kimi-k2
OPENROUTER_HTTP_REFERER=          # Optional, identifies your app in OpenRouter logs
OPENROUTER_APP_TITLE=             # Optional, shown in OpenRouter dashboard
```

**Never commit secrets.** Use Vercel environment variables for deployments.

## Deployment

- Platform: Vercel
- Auto-deploys from GitHub pushes
- Configure environment variables in Vercel dashboard
- Current deployment: `sneak-stream-claude-code` project under `illscience's projects` team

## Git & Commit Guidelines

**CRITICAL: NEVER commit changes to git unless the user EXPLICITLY asks you to commit or check in.**

- Do NOT automatically stage files
- Do NOT automatically commit changes
- Wait for user confirmation before any git write operations
- When user explicitly requests: use small, imperative commits like `Add muted autoplay control`, `Fix: prevent double chat send`
- Reference touched areas in body when change spans modules
- Run `npm run lint` before committing
- PRs need: concise summary, screenshots/clips for UI changes, manual verification checklist
