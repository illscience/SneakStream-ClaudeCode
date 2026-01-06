Goal (incl. success criteria):
- Back up production Convex data and copy it into development for realistic testing.

Constraints/Assumptions:
- Do not modify production DB; read-only access for backup.
- OK to overwrite development data (confirm wipe).

Key decisions:
- None yet.

State:
- On branch `qol-improvements`; prod→dev data copy completed.

Done:
- QoL changes committed on `qol-improvements`.
- Prod snapshot created and imported into dev (with file storage).
- Convex functions deployed to dev for user backfill.

Now:
- Backfilled users from messages in dev and redeployed Convex (created 20 users).

Next:
- Verify @mention autocomplete includes `jennylasers`.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- http/CONTINUITY.md
- backups/convex-prod-20260105-221444.zip (full prod snapshot with file storage)
- backups/convex-prod-20260105-221444-filtered.zip (schema-matched snapshot for import)
