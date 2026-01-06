Goal (incl. success criteria):
- Implement chat QoL: GIF link embeds, mobile stability, portrait image styling, @ mention autocomplete, love button, and remove all nightclub/dancefloor features.

Constraints/Assumptions:
- Work on `qol-improvements` branch.
- Use preview deployments unless production is explicitly requested.
- Do not modify production DB; user will deploy schema changes to dev.

Key decisions:
- Follow requested implementation order: remove dancefloor first, then mobile/chat UI fixes, then GIFs, loves, @mentions.

State:
- On branch `qol-improvements`; QoL changes complete; user testing locally.

Done:
- Created `qol-improvements` branch for QoL work.
- Removed nightclub pages/components/APIs and homepage/admin references.
- Deleted nightclub Convex tables from schema and removed related server code files.
- Applied mobile chat stability tweaks and portrait image styling updates.
- Added GIF URL detection and inline rendering in chat messages.
- Added love button support (schema + Convex + UI) and ran `npx convex codegen`.
- Added @mention autocomplete (Convex user search + LiveChat UI).

Now:
- Normalize GIF links (e.g., giphy.com/...) to direct GIF URLs for inline rendering.

Next:
- Deploy preview if requested.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- app/components/LiveChat.tsx
- app/page.tsx
- app/admin/page.tsx
- convex/schema.ts
- convex/chat.ts
- convex/users.ts
- app/globals.css
