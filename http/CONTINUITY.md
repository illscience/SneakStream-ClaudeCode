Goal (incl. success criteria):
- Emotes picker works and local dev server runs without 500s (notably `/favicon.ico`).

Constraints/Assumptions:
- Emotes stored as static assets under `public/emotes/` (no DB changes).
- Must work on mobile web and match existing neon chat style.
- Do not modify the production database.

Key decisions:
- Represent emote messages as `:emote:<filename>` in `messages.body`, render via static emote manifest.
- If Next favicon route breaks locally, serve favicon from `public/favicon.ico` instead of `app/favicon.ico`.

State:
- On branch `qol-improvements`; emotes feature implemented and committed, but local dev hit 500s due to missing `.next` chunk for `/favicon.ico` (UNCONFIRMED root cause).

Done:
- Extracted emote images from `~/Downloads/Images.zip` into `public/emotes/`.
- Added `lib/emotes.ts` manifest and emote picker + emote message rendering in `app/components/LiveChat.tsx`.
- Smoke-tested via `npm run build` (ESLint circular JSON warning persists but build completes).

Now:
- Fix local `/favicon.ico` 500 by moving favicon to `public/` (or rebuilding `.next`).

Next:
- Verify `npm run dev` no longer 500s on `/` and `/favicon.ico`.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- app/components/LiveChat.tsx
- lib/emotes.ts
- public/emotes/*
 - app/favicon.ico
 - public/favicon.ico
