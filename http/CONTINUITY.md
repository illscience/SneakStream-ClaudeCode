Goal (incl. success criteria):
- Add chat emotes picker: button next to photo, gallery of emotes, tap to send and render inline in chat.

Constraints/Assumptions:
- Emotes stored as static assets under `public/emotes/` (no DB changes).
- Must work on mobile web and match existing neon chat style.

Key decisions:
- Represent emote messages as `:emote:<filename>` in `messages.body`, render via static emote manifest.

State:
- On branch `qol-improvements`; emote assets extracted and UI implementation in progress (uncommitted).

Done:
- Extracted emote images from `~/Downloads/Images.zip` into `public/emotes/`.

Now:
- Implement emote picker UI and message rendering in `app/components/LiveChat.tsx`.

Next:
- Test locally and commit changes.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- app/components/LiveChat.tsx
- lib/emotes.ts
- public/emotes/*
