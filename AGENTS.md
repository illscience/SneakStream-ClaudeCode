# Repository Guidelines

## Project Structure & Module Organization
DJ Sneak runs on Next.js 15 using the App Router. Route groups live under `app/` (e.g., `app/feed`, `app/watch`, `app/events`). Shared UI sits in `components/`, while cross-cutting helpers (player hooks, Convex clients) live in `lib/`. Realtime back end logic is in `convex/` with entry points like `convex/livestream.ts` and the schema in `convex/schema.ts`. Static assets and favicons stay in `public/`. One-off scripts, such as `scripts/make-admin.js`, are for operational tasks; keep them idempotent.

## Build, Test, and Development Commands
Run `npm install` once after cloning. Use `npm run dev` to start Next.js with Turbopack; pair it with `npx convex dev` when you need the Convex live backend. `npm run build` produces the production bundle, and `npm start` serves the built output. Execute `npm run lint` before opening a PR to apply the repository’s ESLint config (`eslint.config.mjs`).

## Coding Style & Naming Conventions
TypeScript is required for all new modules. Default to React Server Components inside `app/` and client components only when stateful UI demands it (`"use client"` at the top). Follow Tailwind utility-first styling; colocate component styles in JSX instead of global CSS. Use camelCase for variables and functions, PascalCase for components, and kebab-case file names under `components/`. Keep imports ordered by scope (external, internal, relative) and prefer async/await over raw promises.

## Testing Guidelines
Automated tests are thin today; contribute by adding component tests with React Testing Library or integration coverage against Convex mocks. Place UI specs adjacent to features (e.g., `app/watch/__tests__/player.test.tsx`). Every PR should include a manual verification checklist covering live stream playback, chat, and uploads, plus updated Convex schema type generation via `npx convex codegen` if models change.

## Commit & Pull Request Guidelines
Commits should be small, imperative, and scoped: `Add muted autoplay control`, `Fix: Remove unsupported Player props`, etc. Reference related files in the body when the diff spans multiple areas, and avoid grouped "misc fixes" commits. PRs must include a concise summary, screenshots or screen recordings for UI work, and links to Convex board issues if available. Confirm lint passes and note any testing gaps explicitly before requesting review.

## Environment & Secrets
Create `.env.local` from the template in `README.md`, supplying Clerk, Convex, Livepeer, and Claude keys. Never commit secrets; rely on Vercel environment variables for deployments. When sharing logs, redact viewer tokens and user IDs.
