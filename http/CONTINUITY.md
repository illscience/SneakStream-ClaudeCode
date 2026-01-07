Goal (incl. success criteria):
- Emote picker shows a horizontal row below the input; tapping an emote posts it and closes the picker.

Constraints/Assumptions:
- Emotes stored as static assets under `public/emotes/` (no DB changes).
- Must work on mobile web and match existing neon chat style.
- Do not modify the production database.

Key decisions:
- Represent emote messages as `:emote:<filename>` in `messages.body`, render via static emote manifest.
- If Next favicon route breaks locally, serve favicon from `public/favicon.ico` instead of `app/favicon.ico`.

State:
- On branch `qol-improvements`; emotes feature implemented and committed, favicon served from `public/favicon.ico` to avoid `/favicon.ico` 500s.

Done:
- Extracted emote images from `~/Downloads/Images.zip` into `public/emotes/`.
- Added `lib/emotes.ts` manifest and emote picker + emote message rendering in `app/components/LiveChat.tsx`.
- Smoke-tested via `npm run build` (ESLint circular JSON warning persists but build completes).

Now:
- Emote row wraps instead of horizontal scroll; textarea no longer flex-grows with picker.

Next:
- Verify emote row wraps to a second line without expanding textarea height.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- app/components/LiveChat.tsx
- lib/emotes.ts
- public/emotes/*
 - app/favicon.ico
 - public/favicon.ico
