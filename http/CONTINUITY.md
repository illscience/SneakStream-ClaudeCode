Goal (incl. success criteria):
- Implement multi-admin support (shared admin library + shared stream credentials + admin management UI + server-side admin guards) and provide dev-only Convex commands; migrate dev first before production.

Constraints/Assumptions:
- Admin-only pages for now (library/upload/go-live/admin); no super-admin role.
- Server-side guards via Convex auth; never trust client-provided clerkId for caller.
- Do not touch production data until dev migration verified and user approves.
- Do not expose secrets from `.env.local` in responses.

Key decisions:
- Shared resources use namespaced IDs: `system/admin-library` and `system/admin-shared`.
- Videos record `uploadedBy`; livestreams track `startedBy` + `endedBy` for attribution/audit.
- Admin list + search lives on `app/admin/page.tsx`, managed by any admin.

State:
- Rollback applied in code: Convex admin checks now trust client-supplied `clerkId`; server-side guards removed in most functions. (UNCONFIRMED)

Done:
- Dev access confirmed via `npx convex data users`.
- Ran `npx convex deploy` (dev), added indexes.
- Ran `npx convex codegen`.
- Ran `adminSettings:seedInitialAdmin` (seeded clerkId `user_37iEeq0OjrRQgO7jLOU884ygane`).
- Ran `videos:migrateVideosToSharedLibrary` with admin identity: migrated 12, hasMore false.
- Ran `streamCredentials:migrateToSharedCredentials` with admin identity: migrated true, deletedOld false.
- Granted admin to `illscience@gmail.com` (`user_31mrtba3Ec527NAH1ijSKMOaLqg`) and verified via `getAdmins` (dev).
- Added TODO in `convex/adminSettings.ts` to restore ctx.auth-based admin checks later. (UNCONFIRMED)

Now:
- Dev migration complete including additional userId migrations for legacy videos; capture these userIds for prod migration checklist.

Next:
- When migrating prod, include source userIds `user_31mrt...`, `user_34UsES...`, `user_34Ulgf...` in migration list.

Open questions (UNCONFIRMED if needed):
- What Clerk JWT template name should be used for Convex (`convex` or different)?

Working set (files/ids/commands):
- http/CONTINUITY.md
- .env.local
- convex/schema.ts
- convex/adminSettings.ts
- convex/streamCredentials.ts
- convex/videos.ts
- convex/livestream.ts
- app/admin/page.tsx
- app/library/page.tsx
- app/upload/MuxUploadPage.tsx
- app/go-live/MuxGoLivePage.tsx
- lib/convexServer.ts
