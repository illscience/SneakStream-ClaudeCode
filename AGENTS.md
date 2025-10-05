# Repository Guidelines

## Project Structure & Module Organization
The app runs on Next.js 15 App Router. Feature routes live under `app/` (e.g., `app/watch`) with colocated layouts and loading states. Shared UI resides in `components/` (kebab-case files). Cross-cutting utilities, hooks, and Convex clients sit in `lib/`. Realtime Convex actions and schema files are under `convex/` (`convex/livestream.ts`, `convex/schema.ts`). Static assets and favicons belong in `public/`. Operational scripts like `scripts/make-admin.js` must stay idempotent. Place feature tests beside the route in an `__tests__/` folder when needed.

## Build, Test, and Development Commands
Run `npm install` once per clone to sync dependencies. Start the local app with `npm run dev`; pair it with `npx convex dev` whenever backend functions are needed. Produce a production bundle with `npm run build` and preview it via `npm start`. Execute `npm run lint` before opening a PR to apply the shared ESLint config. Regenerate Convex types after schema changes using `npx convex codegen`.

## Coding Style & Naming Conventions
Write only in TypeScript and default to React Server Components in `app/`. Opt into client components with a leading `"use client"` directive only when state or browser APIs are required. Follow Tailwind utility-first styling inside JSX; avoid new global CSS. Use camelCase for variables/functions, PascalCase for components, and kebab-case for files under `components/`. Order imports by scope: external packages, internal aliases, then relative paths. Prefer async/await and descriptive prop names over abbreviated forms.

## Testing Guidelines
UI coverage should target React Testing Library with Jest-style assertions. Place specs next to the feature (`app/watch/__tests__/player.test.tsx`) and mirror the component name. When modifying Convex schema or player flows, document manual verification steps for playback, chat, and uploads, and rerun `npx convex codegen`. Add mocks for Convex calls to keep tests deterministic.

## Commit & Pull Request Guidelines
Write small, imperative commits (`Add muted autoplay control`, `Fix: prevent double chat send`). Reference all touched areas in the body when the change spans modules. Pull requests need a concise summary, screenshots or clips for UI updates, and links to related Convex board issues. Confirm `npm run lint` passes, call out remaining risks or testing gaps, and include the manual verification checklist before requesting review.

## Environment & Secrets
Create `.env.local` from the template in `README.md`, populating Clerk, Convex, Livepeer, and Claude keys. Never commit secrets; rely on Vercel environment variables for deployments. Redact viewer tokens and user identifiers when sharing logs or metrics.
