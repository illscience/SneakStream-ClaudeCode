Goal (incl. success criteria):
- Logged-out users see a clear sign-in prompt; chat input/actions hidden.

Constraints/Assumptions:
- Emotes stored as static assets under `public/emotes/` (no DB changes).
- Must work on mobile web and match existing neon chat style.
- Do not modify the production database.

Key decisions:
- Represent emote messages as `:emote:<filename>` in `messages.body`, render via static emote manifest.
- If Next favicon route breaks locally, serve favicon from `public/favicon.ico` instead of `app/favicon.ico`.

State:
- On branch `qol-improvements` tracking origin; signed-out chat composer hidden update committed and pushed; favicon served from `public/favicon.ico`.

Done:
- Extracted emote images from `~/Downloads/Images.zip` into `public/emotes/`.
- Added `lib/emotes.ts` manifest and emote picker + emote message rendering in `app/components/LiveChat.tsx`.
- Smoke-tested via `npm run build` (ESLint circular JSON warning persists but build completes).
- Emote picker row wraps to multiple lines without resizing the textarea.
- Hide chat composer when signed out; show sign-in CTA.

Now:
- Ready for next request.

Next:
- Verify signed-out flow on mobile and desktop.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- app/components/LiveChat.tsx
- lib/emotes.ts
- public/emotes/*
 - app/favicon.ico
 - public/favicon.ico
