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

**Mobile Native App (Expo):**
```bash
cd mobile && npm install       # Install mobile dependencies
cd mobile && npx expo start --ios      # Run Expo app in iOS simulator
cd mobile && npx expo start --android  # Run Expo app in Android emulator/device
cd mobile && npm run ios       # Build/run native iOS target
cd mobile && npm run android   # Build/run native Android target
cd mobile && npx eas build --platform ios --profile production --non-interactive    # TestFlight build
cd mobile && npx eas submit --platform ios --profile production --latest --non-interactive  # Submit to TestFlight
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

### Mobile Native App Architecture (`mobile/`)
The repository includes an Expo/React Native app that mirrors the main live-stream experience from web:
- synchronized playback
- real-time chat
- emotes and photo uploads
- live auction bidding/payment entry points

Key files:
- `mobile/src/app/_layout.jsx` - Root providers and Convex auth bridge setup
- `mobile/src/app/sign-in.jsx` - Native OAuth sign-in via Clerk FAPI
- `mobile/src/app/(tabs)/index.jsx` - Main live screen (video/chat/emotes/photo upload/auction mount)
- `mobile/src/components/AuctionPanel.jsx` - Auction UI and bidder/admin actions
- `mobile/src/lib/fapi-auth.jsx` - Mobile auth state and Clerk FAPI wrapper
- `mobile/src/lib/web-api.js` - Authenticated calls from mobile to web API routes
- `mobile/src/lib/convex.ts` - Convex React client using `EXPO_PUBLIC_CONVEX_URL`

### Mobile Auth Model (Important)
Mobile intentionally uses a custom Clerk FAPI-based auth implementation instead of default Clerk Expo provider behavior.

Why:
- we observed session instability/race conditions in headless flows
- custom flow gives deterministic token rotation and persisted client session behavior

How it works:
1. Store Clerk client JWT in `expo-secure-store` (`__clerk_client_jwt`).
2. Use `clerkFetch(path, options)` in `mobile/src/lib/fapi-auth.jsx` for Clerk requests.
3. Add `_is_native=1` and `_clerk_js_version=5` query params to Clerk calls.
4. Send stored JWT in `authorization` header.
5. Read response `authorization` header and overwrite stored JWT (rotation).
6. On refresh, read `/v1/client`, find active session, then validate with `/v1/client/sessions/{id}/tokens/convex`.
7. If token validation fails, clear stored JWT and treat user as signed out.

Do not replace this auth model unless full session/token lifecycle is revalidated on physical iOS and Android devices.

### Mobile Convex Auth Bridge
`mobile/src/app/_layout.jsx` wires Convex with a custom `useConvexFAPIAuth` hook:
- `isAuthenticated` is `true` only when Clerk state is signed-in and sessionId exists.
- `fetchAccessToken()` requests `/v1/client/sessions/{sessionId}/tokens/convex`.
- Session ID is stored in a ref to avoid stale closures in provider callbacks.

This keeps Convex auth state aligned with Clerk session state on mobile.

### Mobile Native Sign-In Flow
Implemented in `mobile/src/app/sign-in.jsx`:
1. Build redirect URI via `AuthSession.makeRedirectUri({ path: "sso-callback" })`.
2. Start Clerk sign-in: `POST /v1/client/sign_ins` with strategy (`oauth_google`, `oauth_apple` on iOS).
3. Open OAuth browser via `WebBrowser.openAuthSessionAsync`.
4. Parse `rotating_token_nonce` from callback URL.
5. Reload sign-in via `GET /v1/client/sign_ins/{id}?rotating_token_nonce=...`.
6. If status is transferable (new user path), call `POST /v1/client/sign_ups` with `transfer=true`.
7. Refresh auth context (`useFAPIAuth().refresh`) and return to app.

### Mobile Live Screen Behavior
`mobile/src/app/(tabs)/index.jsx` includes:
- Playback from Convex queries (`api.playbackState.getPlaybackState`, fallbacks to default/public videos).
- Global timeline sync using shared start time with modulo by duration.
- Foreground resync on app re-activation.
- Heart mutation (`api.videos.incrementHeartCount`) guarded by local one-tap state.
- User profile upsert to Convex (`api.users.upsertUser`) after auth+Convex readiness.

### Mobile Chat, Emotes, and Photo Upload
Chat/Realtime:
- Messages loaded with `usePaginatedQuery(api.chat.getMessagesPage, ...)`.
- Text messages via `sendMessage({ body })`.

Emotes:
- Token protocol in message body: `:emote:<id>`.
- Mobile emote picker sends those tokens directly.
- Emote IDs are fixed to `image0.png ... image64.png`.
- Base URL resolution:
  - `EXPO_PUBLIC_EMOTE_BASE_URL`
  - fallback `EXPO_PUBLIC_APP_URL`
  - fallback `EXPO_PUBLIC_BASE_URL`
  - fallback `https://www.dreaminaudio.xyz`
- Emote IDs are validated against `^[A-Za-z0-9._-]+$` before building URLs.

Photo upload:
1. Ask media permission via `expo-image-picker`.
2. Enforce max size of 8MB.
3. Convert selected local URI to blob.
4. Call `api.chat.generateUploadUrl`.
5. POST blob to returned upload URL with inferred mime type.
6. Send message with `imageStorageId` and `imageMimeType`.

Special tokenized chat cards rendered in mobile feed:
- `:crate_purchase:<json>`
- `:auction:<json>`

### Mobile Auction Integration (No Convex Schema Changes)
Auction on mobile is intentionally implemented using existing backend contracts that already power web.

Used Convex functions:
- `api.bidding.getCurrentSession`
- `api.adminSettings.checkIsAdmin`
- `api.bidding.openBidding`
- `api.bidding.closeBidding`
- `api.bidding.placeBid`
- `api.bidding.processBiddingExpiry`

Behavior:
- Admin can open/close bidding directly from mobile UI.
- Signed-in users can claim/outbid in open sessions.
- Countdown runs from `biddingEndsAt` / `paymentDeadline`.
- On timeout with holder, mobile triggers `processBiddingExpiry` once per session ID (ref guard).
- Winner payment uses authenticated web endpoint call:
  - `POST /api/bidding/create-session` with `sessionId` and `livestreamId`
  - open returned checkout URL in `expo-web-browser`
- When auth/session token for payment endpoint fails, UI shows web fallback CTA.

### Mobile Web API Auth Bridge
`mobile/src/lib/web-api.js` provides:
- `getWebBaseUrl()` / `getWebUrl(path)` with env fallback chain
- `authorizedWebFetch(...)`:
  - request Clerk session token (`/v1/client/sessions/{sessionId}/tokens`)
  - set `Authorization: Bearer <token>`
  - call web API endpoint

Use this path when a feature has a web API contract but no dedicated Convex action for mobile.

### Mobile Environment Variables
Used by native app:
- `EXPO_PUBLIC_CONVEX_URL` (required)
- `EXPO_PUBLIC_WEB_BASE_URL` (recommended)
- `EXPO_PUBLIC_EMOTE_BASE_URL` (optional emote host override)
- `EXPO_PUBLIC_APP_URL` / `EXPO_PUBLIC_BASE_URL` (fallbacks)

Notes:
- Clerk frontend URL is currently hardcoded to `https://clerk.sneakstream.xyz` in mobile auth modules.
- Keep web and mobile domain configuration aligned for token + checkout flows.

### Switching Mobile Between Dev and Production
The mobile app uses two env files:
- `mobile/.env` — **production** values (Convex `resilient-spider-207`, web `sneakstream.xyz`)
- `mobile/.env.local` — **dev** values (Convex `colorful-ant-503`), overrides `.env` when present

To point the local simulator at **production**:
```bash
mv mobile/.env.local mobile/.env.local.bak    # Disable dev overrides
cd mobile && npx expo start --ios --clear      # Restart with production env
```

To restore **dev** mode:
```bash
mv mobile/.env.local.bak mobile/.env.local     # Re-enable dev overrides
cd mobile && npx expo start --ios --clear       # Restart with dev env
```

EAS production builds (`eas.json` `production` profile) inject their own env vars and ignore both files.

### Mobile Debug Checklist
When mobile auth/chat/auction issues occur, verify in order:
1. `EXPO_PUBLIC_CONVEX_URL` resolves correctly.
2. `useFAPIAuth()` has `isSignedIn=true` with sessionId.
3. `useConvexAuth().isAuthenticated` is true.
4. Clerk token endpoints succeed (`/tokens/convex` and `/tokens`).
5. Chat upload returns `storageId`.
6. Auction checkout endpoint returns a URL from `/api/bidding/create-session`.

### Mobile Change Guardrails
- Prefer reusing existing Convex/web contracts before introducing new schema or API surface.
- Keep auth logic centralized in `mobile/src/lib/fapi-auth.jsx` and root provider wiring.
- Preserve token rotation behavior in `clerkFetch`.
- Validate both signed-out and signed-in flows after mobile changes:
  - chat send
  - emote send/render
  - image upload
  - auction bid/payment

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

- Small, imperative commits: `Add muted autoplay control`, `Fix: prevent double chat send`
- Reference touched areas in body when change spans modules
- Run `npm run lint` before committing
- PRs need: concise summary, screenshots/clips for UI changes, manual verification checklist
