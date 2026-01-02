Goal (incl. success criteria):
- Add image (including animated GIF) support to chat so pasted images are stored and rendered in the chat stream on desktop and mobile web.
- Fix avatar upload/select flow so users can choose or upload avatars successfully in dev/prod.
- Add chat GIF remix via img2vid, with admin-configurable model and reusable FAL client, tested in dev DB only.
- Switch back to `main` and revert local changes while keeping the feature branch for later; advise on dev/prod schema mismatch handling.

Constraints/Assumptions:
- Next.js 15 App Router; follow repo guidelines (Tailwind in JSX, kebab-case components, keep UI patterns).
- Convex backs chat; default to using existing storage patterns unless a better choice emerges.
- Preserve existing chat behaviors and tests; animated GIFs must remain animated.

Key decisions:
- Store pasted chat images in Convex file storage (imageStorageId) and expose URLs via chat query.

State:
- Backend updated for image attachments; LiveChat/ChatWindow support paste/file upload with previews and render images (now also auto-playing looped inline videos when MIME is video/*); deployed to Convex dev (colorful-ant-503). Local builds now succeed with lint deps installed (ESLint still logs a circular-structure warning but exits 0). Prod Convex is resilient-spider-207. Convex CLI reconfigured; prod deployment now updated successfully. Prod admin setting showNightclubOnHome set to false to hide generative dancefloor. Profile avatar upload UI updated (visible button + mobile-friendly). Chat GIF remix implemented (dev deploy only) with admin-selectable img2vid model and reusable FAL helper; remix action now defaults to wan/v2.6/image-to-video, handles mediaUrl/isVideo, stores blobs with real content-types, and now lives in node runtime (convex/remix.ts) with GIF frame extraction for first/last frame models.

Done:
- Added Convex message schema fields + upload URL mutation, delete cleans up storage.
- Updated LiveChat and ChatWindow for image paste/upload, previews, and rendering (incl GIFs).
- Attempted `npm run lint` → fails because ESLint package missing (Next.js lint deprecation notice).
- Fixed Convex schema indexes (removed `_creationTime` entries), deployed to dev.
- Runtime smoke test against dev Convex: generated upload URL, uploaded `temp01.png`, sent/verified image message, then deleted it (no persistent chat pollution).
- Added ESLint dev deps (`eslint`, `eslint-config-next`) and fixed Convex Id typing in chat components; `npm run build` now succeeds locally (with a non-fatal circular JSON warning from ESLint).
- Improved chat upload MIME handling (explicit gif fallback) and avatar fallback display.
- Inserted admin user in prod (`admin-script` with illscience@gmail.com) and set `showNightclubOnHome=false` on prod (resilient-spider-207).
- Exported dev data and imported into prod (replace). Prod now populated with dev data across tables (messages/videos/livestreams/events/playlist/etc.).
- Patched avatar selection mutation to auto-create user if missing; deployed to dev (colorful-ant-503) and prod (resilient-spider-207).
- Added Convex avatar upload helpers; redeployed functions to dev and prod so profile avatar upload works.
- Extended admin settings to store arbitrary values; added img2vid model setting UI.
- Added remixOf field to messages; new remix action storing generated GIFs; Remix buttons in chat UIs; reusable FAL img2vid helper; remix action now uses working default model and MIME handling.
- Deployed Convex changes to dev deployment only (colorful-ant-503) for remix/testing; latest deployment includes remix action fixes.
- Verified FAL key by generating an image via fal-ai/flux-pro/v1.1 (working) using provided key.
- Chat UIs render video attachments with auto-play/loop/muted/playsInline if MIME is video/*.
- generateImg2Vid default model switched to wan/v2.6/image-to-video; verified model produces mp4 (example: https://v3b.fal.media/files/b/0a88b75a/hYlj3ygejcCK76OfhZcTH_mVip4yVZ.mp4). Added support for fal-ai/veo3.1/fast/first-last-frame-to-video with first/last frame extraction from GIFs (>240px) and fallback to original image for stills.
- Remix action now forces a default prompt (“Remix animation”) for wan/v2.6/image-to-video to satisfy required prompt input; Convex redeployed to dev after change. Img2Vid errors surface friendly messages (e.g., “Image dimensions are too small”).
- Added error logging and longer timeout/poll interval for FAL img2vid; default prompt now always sent; Convex redeployed to dev.
- Remixed GIF test (500x273) produced video/mp4 stored at message j5712yhb59kg3s4qtj2f4a6yxn7ye5cw (dev DB) via veo3.1 model.

Now:
- User requested to switch back to `main` and discard local changes on feature branch; need confirmation about deleting untracked files. Advise on dev vs prod schema mismatch (dev data can be reset).

Next:
- If approved: discard tracked changes + clean untracked files, then switch to `main`. Optionally redeploy `main` to dev and reset dev data via Convex dashboard if desired.

Open questions (UNCONFIRMED if needed):
- None right now.

Working set (files/ids/commands):
- http/CONTINUITY.md
