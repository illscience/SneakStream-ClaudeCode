Goal (incl. success criteria):
- Update branding text to “djsneak” and hide “My Library” from non-admins.
- Ensure the UI reflects these changes in preview after deployment.

Constraints/Assumptions:
- Keep `main` clean; feature work remains on `feature/remix-video`.
- Use preview deployments unless production is explicitly requested.

Key decisions:
- Gate `/library` nav link by admin status.
- Rename logo text to “djsneak”.
- Update admin email to `sneakthedj@gmail.com` (case-insensitive compare).

State:
- On branch `qol-improvements`; `STABLE` tag created on `main`.

Done:
- Set `/library` nav link to admin-only.
- Replaced logo text with “djsneak” and verified animation uses `logoText`.
- Added admin gating + redirect in `app/library/page.tsx`.
- Updated admin email in `convex/adminSettings.ts`.
- Deployed Convex functions to dev (`colorful-ant-503`) and prod (`resilient-spider-207`).
- Deployed Vercel preview and production builds (preview URL in latest run output).
- Ran `npm run build` (ESLint circular JSON warning, build still completed).
- Committed changes on `main` and created `STABLE` tag with Jan 2 DJ Sneak party message.

Now:
- Ready for QoL improvements work.

Next:
- None.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- components/navigation/MainNav.tsx
- app/library/page.tsx
- convex/adminSettings.ts
- http/CONTINUITY.md
- Preview deploy: https://sneak-stream-claude-code-1criixjdr-illscience-5392s-projects.vercel.app
- Production deploy: https://sneak-stream-claude-code-dukvm8gqu-illscience-5392s-projects.vercel.app
