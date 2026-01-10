Goal (incl. success criteria):
- Implement multi-admin support per approved plan; success is shared admin library/credentials, admin management, migrations, guards, and updated UI.

Constraints/Assumptions:
- Follow AGENTS.md instructions; maintain this ledger.
- Approval policy: never; sandbox danger-full-access; network enabled.
- Library page is admin-only; any admin can manage admins.

Key decisions:
- Use shared IDs: system/admin-library and system/admin-shared.
- Admin checks use ctx.auth identity; server-side guards on admin ops.
- Admin-only API routes require Clerk auth via Convex JWT.

State:
- Core code changes applied across schema, Convex functions, UI, and API routes.

Done:
- Updated schema (users.isAdmin + indexes, videos.uploadedBy, livestreams.startedBy/endedBy).
- Added admin auth helpers/constants, admin management queries/mutations, and seed/migration mutations.
- Switched to shared stream credentials and admin library in Convex + UI.
- Added admin guards to Convex mutations/queries and API routes.
- Updated admin, library, upload, go-live, nav, chat UI to new admin model.
- Added Clerk->Convex auth integration and server route auth helper.
- FIXED: Webhook handler now always saves livestream recordings to admin library (even without matching Convex stream record).
- Added comprehensive logging to webhook handler for debugging.
- Fixed false "Recording saved" message in MuxGoLivePage.
- Added tests for webhook scenarios (tests/webhook.mux.test.ts).
- Added dev stream helper functions (lib/streamProvider.ts).

Now:
- Manual end-to-end testing to verify the fix.

Next:
- Create dedicated Mux dev stream for testing (if not already done).
- Set up ngrok or Vercel preview for webhook testing.
- Test the full flow: OBS → Mux → webhook → Convex → library.

Open questions (UNCONFIRMED if needed):
- Ensure Clerk JWT template for Convex is configured ("convex"), or adjust if different.

Working set (files/ids/commands):
- /Users/illscience/SneakStream-ClaudeCode/convex/schema.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/adminSettings.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/streamCredentials.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/videos.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/livestream.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/playlist.ts
- /Users/illscience/SneakStream-ClaudeCode/convex/chat.ts
- /Users/illscience/SneakStream-ClaudeCode/app/ConvexClientProvider.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/admin/page.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/library/page.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/upload/MuxUploadPage.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/upload/LivepeerUploadPage.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/go-live/MuxGoLivePage.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/go-live/LivepeerGoLivePage.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/go-live/page.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/playlist/page.tsx
- /Users/illscience/SneakStream-ClaudeCode/components/navigation/MainNav.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/components/LiveChat.tsx
- /Users/illscience/SneakStream-ClaudeCode/app/api/stream/import-mux-assets/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/stream/sync-recordings/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/stream/create/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/stream/enable/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/stream/end/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/upload/request/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/upload/status/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/video/delete/route.ts
- /Users/illscience/SneakStream-ClaudeCode/app/api/webhooks/mux/route.ts
- /Users/illscience/SneakStream-ClaudeCode/lib/adminConstants.ts
- /Users/illscience/SneakStream-ClaudeCode/lib/convexServer.ts
