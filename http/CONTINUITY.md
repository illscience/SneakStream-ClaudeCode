Goal (incl. success criteria):
- Merge qol-improvements into main and sync with origin.

Constraints/Assumptions:
- Emotes stored as static assets under `public/emotes/` (no DB changes).
- Must work on mobile web and match existing neon chat style.
- Do not modify the production database.

Key decisions:
- Represent emote messages as `:emote:<filename>` in `messages.body`, render via static emote manifest.
- If Next favicon route breaks locally, serve favicon from `public/favicon.ico` instead of `app/favicon.ico`.

State:
- On branch `main`; qol-improvements merged and pushed; working tree clean except untracked `backups/`.

Done:
- Extracted emote images from `~/Downloads/Images.zip` into `public/emotes/`.
- Added `lib/emotes.ts` manifest and emote picker + emote message rendering in `app/components/LiveChat.tsx`.
- Smoke-tested via `npm run build` (ESLint circular JSON warning persists but build completes).
- Emote picker row wraps to multiple lines without resizing the textarea.
- Hide chat composer when signed out; show sign-in CTA.
- Verified `public/emotes/*` images are tracked and pushed.

Now:
- Main is up to date with origin after merge.

Next:
- None queued.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- app/components/LiveChat.tsx
- lib/emotes.ts
- public/emotes/*
 - app/favicon.ico
 - public/favicon.ico
