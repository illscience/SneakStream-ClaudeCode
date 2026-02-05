# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DJ Sneak is a Next.js 15-based live streaming platform featuring live DJ streams, video on demand, real-time chat, and AI-powered event discovery. The stack includes Livepeer/Mux for video infrastructure, Convex for real-time backend, Clerk for authentication, and Tailwind CSS for styling.

## Development Commands

**Setup:**
```bash
npm install                    # Install dependencies
```

**Development:**
```bash
npm run dev                    # Start Next.js dev server with Turbopack (port 3000)
npx convex dev                 # Start Convex backend (run in parallel with dev server)
npx convex codegen             # Regenerate TypeScript types after schema changes
```

**Production:**
```bash
npm run build                  # Build for production with Turbopack
npm start                      # Start production server
```

**Code Quality:**
```bash
npm run lint                   # Run ESLint (required before PRs)
npm run test                   # Run Vitest tests
```

**Utilities:**
```bash
node scripts/make-admin.js     # Grant admin privileges (idempotent)
```

## Architecture

### Directory Structure
- `app/` - Next.js 15 App Router pages with colocated layouts and loading states
  - Routes: `/`, `/watch`, `/go-live`, `/upload`, `/library`, `/feed`, `/profile`, `/api`
- `components/` - Shared UI components (kebab-case files)
- `lib/` - Cross-cutting utilities, hooks, and client setup
  - `streamProvider.ts` - Mux/Livepeer provider selection logic
  - `mux.ts` / `livepeer.ts` - Provider-specific implementations
- `convex/` - Realtime backend functions and schema
  - `schema.ts` - Database schema with tables: messages, users, follows, videos, events, livestreams, playbackState
  - `*.ts` - Backend functions for chat, videos, livestreams, events, follows, users
- `public/` - Static assets
- `scripts/` - Operational scripts (must remain idempotent)
- `tests/` - Test files

### Video Infrastructure
The platform supports **dual video providers** (Mux and Livepeer):
- Provider selection controlled by environment variables (see `lib/streamProvider.ts`)
- Set `NEXT_PUBLIC_STREAM_PROVIDER=mux` to enable Mux frontend experience
- Default is Livepeer if no provider specified
- Video metadata stored in Convex `videos` table with provider-specific fields (`assetId`, `livepeerAssetId`, `playbackId`)

### Real-time Features
- **Convex** powers real-time chat, video updates, follower counts, and synchronized playback
- Run `npx convex dev` alongside Next.js dev server for backend functionality
- After modifying `convex/schema.ts`, always run `npx convex codegen` to regenerate types

### Authentication
- **Clerk** handles user authentication
- Middleware at `middleware.ts` protects routes
- User data synchronized with Convex via `users` table

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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
NEXT_PUBLIC_STREAM_PROVIDER=     # "mux" or "livepeer" (defaults to livepeer)
CLAUDE_API_KEY=                   # For AI event discovery
```

**Never commit secrets.** Use Vercel environment variables for deployments.

## Deployment

- Platform: Vercel
- Auto-deploys from GitHub pushes
- Configure environment variables in Vercel dashboard
- Current deployment: `sneak-stream-claude-code` project under `illscience's projects` team

## Commit Guidelines

- **Do NOT commit or push changes unless explicitly asked** - wait for user confirmation before running git commit or git push
- Small, imperative commits: `Add muted autoplay control`, `Fix: prevent double chat send`
- Reference touched areas in body when change spans modules
- Run `npm run lint` before committing
- PRs need: concise summary, screenshots/clips for UI changes, manual verification checklist
