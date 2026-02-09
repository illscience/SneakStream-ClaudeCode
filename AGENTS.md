# Repository Guidelines

## Project Structure & Module Organization
This Next.js 15 App Router codebase keeps feature routes in `app/`, where layouts, loading states, and related tests live beside each route (for example, `app/watch/__tests__/player.test.tsx`). Shared UI belongs in `components/` with kebab-case filenames, while reusable hooks, Convex clients, and utilities live in `lib/`. Realtime actions and schema definitions stay in `convex/`, and static assets reside in `public/`. Keep operational scripts idempotent under `scripts/`.

## Build, Test, and Development Commands
Run `npm install` after cloning to sync dependencies. Use `npm run dev` for the Next.js server and pair it with `npx convex dev` whenever backend functions are needed. Produce a production bundle with `npm run build`, preview it via `npm start`, and lint with `npm run lint`. After editing Convex schemas, regenerate types using `npx convex codegen`.

## Coding Style & Naming Conventions
All source files are TypeScript. Default to React Server Components in `app/`; add the `"use client"` directive only when component state or browser APIs are required. Style UI with Tailwind utilities inside JSX and avoid new global CSS. Order imports by external packages, internal aliases, then relative paths. Use camelCase for variables and functions, PascalCase for components, and kebab-case for component files.

## Testing Guidelines
UI coverage relies on React Testing Library with Jest-style assertions. Co-locate specs with their route inside `__tests__/` folders and mirror the component name (`player.test.tsx`). Keep Convex interactions mocked for determinism. When altering Convex schemas or player flows, document manual verification steps for playback, chat, and uploads alongside your changes and rerun `npx convex codegen`.

## Commit & Pull Request Guidelines
Write small, imperative commits such as `Add muted autoplay control` and reference all impacted areas in the body when necessary. Pull requests need a concise summary, linked Convex board issues, and screenshots or clips for UI updates. Confirm `npm run lint` succeeds, note remaining risks or testing gaps, and include the manual verification checklist before requesting review.

## Security & Configuration Tips
Create `.env.local` from the template in the README, supplying Clerk, Convex, Livepeer, and Claude keys. Never commit secrets; rely on Vercel environment variables in deployment. Redact viewer tokens and user identifiers when sharing logs or metrics.

## Mobile Native Implementation (Expo / React Native)
The repo also contains an Expo React Native app under `mobile/` that mirrors key web features (playback sync, chat, emotes, image upload, and live auction). Use this section as the source of truth for mobile behavior and architecture.

## Mobile Structure & Ownership
- `mobile/src/app/_layout.jsx`: Root providers (SafeArea, gesture handler, FAPI auth provider, Convex provider).
- `mobile/src/app/(tabs)/index.jsx`: Main live experience (video, hearts, chat, emotes, image upload, auction panel integration).
- `mobile/src/app/sign-in.jsx`: Native sign-in flow using Clerk FAPI + Expo AuthSession/WebBrowser.
- `mobile/src/components/AuctionPanel.jsx`: Mobile auction UI and bidding/payment actions.
- `mobile/src/lib/fapi-auth.jsx`: Custom auth state + Clerk FAPI wrapper + secure JWT persistence.
- `mobile/src/lib/web-api.js`: Authenticated bridge to web APIs (used for bidding checkout session creation).
- `mobile/src/lib/convex.ts`: Convex client wiring via `EXPO_PUBLIC_CONVEX_URL`.

## Why Mobile Uses Custom Auth (Important)
Mobile does not rely on Clerk’s default Expo provider flow for session state. We use a custom FAPI-based implementation due to session instability/race issues seen in headless mode.

Core behavior:
- Persist Clerk client JWT in `expo-secure-store` under `__clerk_client_jwt`.
- Route Clerk calls through `clerkFetch(...)` in `mobile/src/lib/fapi-auth.jsx`.
- Add `_is_native=1` and `_clerk_js_version=5` query params to Clerk API calls.
- Send stored JWT via `authorization` header and update stored JWT from response `authorization` header (token rotation support).
- On auth refresh, call `/v1/client` and detect active session.
- Validate session freshness by requesting `/v1/client/sessions/{sessionId}/tokens/convex`; if invalid, clear stored JWT and force re-auth.

Do not replace this with `@clerk/clerk-expo` without validating session/token lifecycle end-to-end on real devices.

## Convex Auth Bridge in Mobile
Convex uses `ConvexProviderWithAuth` in `mobile/src/app/_layout.jsx` with a custom `useConvexFAPIAuth` hook.

Details:
- `isAuthenticated` is true only when `isSignedIn && sessionId`.
- `fetchAccessToken()` calls `/v1/client/sessions/{sessionId}/tokens/convex` via `clerkFetch`.
- Session ID is read from a ref to avoid stale-closure issues while providers remain mounted.

Result: Convex queries/mutations and mobile UI auth state are aligned with Clerk FAPI session state.

## Native Sign-In Flow (OAuth)
Implemented in `mobile/src/app/sign-in.jsx`:
1. Build redirect URI with `AuthSession.makeRedirectUri({ path: "sso-callback" })`.
2. Start Clerk sign-in via `POST /v1/client/sign_ins` with provider strategy (`oauth_google`, `oauth_apple` on iOS).
3. Open provider flow using `WebBrowser.openAuthSessionAsync(...)`.
4. Read `rotating_token_nonce` from callback URL.
5. Reload sign-in (`GET /v1/client/sign_ins/{id}?rotating_token_nonce=...`) to finalize.
6. If verification is transferable, create sign-up with `POST /v1/client/sign_ups` and `transfer=true`.
7. Call `refresh()` from `useFAPIAuth()` and close modal.

## Mobile Live Screen Features
Main screen: `mobile/src/app/(tabs)/index.jsx`.

Implemented behavior:
- Video playback from Convex playback state (`api.playbackState.getPlaybackState`) with fallback to default/public video queries.
- Global playback sync: compute elapsed time from shared `startTime`, loop by duration (`elapsed % duration`), and re-sync when app returns to foreground.
- Heart button calls `api.videos.incrementHeartCount` once per local session (`hasHearted` guard).
- User profile sync to Convex on auth+connection (`api.users.upsertUser`) to keep alias/email/avatar populated for chat and auction.

## Chat, Emotes, and Photo Upload
Chat uses Convex pagination and mutations:
- Messages: `usePaginatedQuery(api.chat.getMessagesPage, ...)`.
- Send text: `sendMessage({ body })`.
- Upload image:
  - Request permission with `expo-image-picker`.
  - Enforce `8MB` max size client-side.
  - Fetch local URI to Blob.
  - Request upload target: `generateUploadUrl({})`.
  - POST blob to returned URL with inferred MIME.
  - Send chat message with `imageStorageId` and `imageMimeType`.

Emotes:
- Emote token format in message body: `:emote:<id>`.
- IDs are currently fixed (`image0.png` through `image64.png`).
- Emote URL base comes from:
  - `EXPO_PUBLIC_EMOTE_BASE_URL`, else
  - `EXPO_PUBLIC_APP_URL`, else
  - `EXPO_PUBLIC_BASE_URL`, else
  - `https://www.dreaminaudio.xyz`
- Base is normalized and `/emotes/<id>` is appended.
- Security guard: emote ID must match `^[A-Za-z0-9._-]+$`.

Special chat tokens rendered as system-style cards:
- `:crate_purchase:<json>`
- `:auction:<json>`

## Auction Integration on Mobile (No Convex Schema Changes)
Auction UI is integrated via `mobile/src/components/AuctionPanel.jsx` and intentionally reuses existing web backend contracts.

Convex contracts used:
- Query: `api.bidding.getCurrentSession`
- Query: `api.adminSettings.checkIsAdmin`
- Mutation: `api.bidding.openBidding`
- Mutation: `api.bidding.closeBidding`
- Mutation: `api.bidding.placeBid`
- Mutation: `api.bidding.processBiddingExpiry`

Behavior:
- Admin can open/close bidding from mobile.
- Signed-in users can claim/outbid.
- Countdown is computed locally from `biddingEndsAt` / `paymentDeadline`.
- On `open` session hitting zero with holder, mobile triggers `processBiddingExpiry` once per session ID (ref guard).
- Payment uses web checkout endpoint (not Convex mutation) via authenticated fetch:
  - `POST /api/bidding/create-session` with `sessionId` and `livestreamId`.
  - Open checkout URL with `expo-web-browser`.
- If auth/token creation fails (`401/403`, missing session, token unavailable), show “Open auction on web” fallback CTA.

## Mobile Web API Bridge
`mobile/src/lib/web-api.js` provides:
- `getWebBaseUrl()` and `getWebUrl(path)` with environment fallbacks.
- `authorizedWebFetch(...)` that obtains a Clerk session JWT from `/v1/client/sessions/{sessionId}/tokens`, then sends `Authorization: Bearer <jwt>` to web API routes.

Use this bridge for mobile->web authenticated endpoints when there is no dedicated Convex action/mutation.

## Mobile Environment Variables
Required/used by current implementation:
- `EXPO_PUBLIC_CONVEX_URL` (required for Convex connection).
- `EXPO_PUBLIC_WEB_BASE_URL` (recommended for explicit web API host).
- `EXPO_PUBLIC_EMOTE_BASE_URL` (optional override for emote CDN/path).
- `EXPO_PUBLIC_APP_URL` / `EXPO_PUBLIC_BASE_URL` (fallbacks).

Notes:
- Clerk frontend URL is currently hardcoded as `https://clerk.sneakstream.xyz` in mobile auth files.
- Keep mobile and web domains aligned to avoid auth token and checkout redirect mismatches.

## Mobile Dev, Build, and Release
From repo root:
- `cd mobile && npm install`
- `cd mobile && npx expo start --ios` (or `--android`)
- `cd mobile && npm run ios` / `npm run android` for native run commands

Release/TestFlight:
- Build via EAS (`mobile/eas.json` production profile uses store distribution and auto-increment build numbers).
- Submit with EAS Submit to App Store Connect/TestFlight.

## Mobile Debugging Playbook
When mobile auth/chat/auction breaks, check in this order:
1. `EXPO_PUBLIC_CONVEX_URL` is present and points to the expected deployment.
2. `useFAPIAuth()` reports `isSignedIn` and a non-empty `sessionId`.
3. Convex auth bridge reports authenticated (`useConvexAuth().isAuthenticated`).
4. Clerk token fetches for Convex and web API succeed (`/tokens/convex` and `/tokens` endpoints).
5. Chat upload flow returns `storageId` from upload URL POST response.
6. Auction payment endpoint returns checkout `url` from `/api/bidding/create-session`.

## Safety Rules for Future Mobile Changes
- Reuse existing Convex contracts first; do not add new Convex schema/functions for parity features unless web contract is insufficient.
- Keep auth changes centralized in `mobile/src/lib/fapi-auth.jsx` and `mobile/src/app/_layout.jsx`.
- Preserve token refresh/rotation handling in `clerkFetch`.
- Validate feature parity on both unauthenticated and authenticated paths (chat send, emote send/render, image upload, auction bid/payment).
