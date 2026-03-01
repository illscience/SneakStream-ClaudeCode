Goal (incl. success criteria):
- Implement Clerk’s recommended React Native sign-in flow (OAuth via WebBrowser) per blog.

Constraints/Assumptions:
- Maintain Continuity Ledger in http://CONTINUITY.md.
- Use rg for search when needed.
- Approval required for network; workspace-write allowed.

Key decisions:
- None yet.

State:
- Updated OAuth sign-in to wait for Clerk readiness and align redirect path.

Done:
- Located React Native packages in `mobile/` and `mobile-backup/`.
- User confirmed review target is `mobile/`.
- Reviewed entry points, main screen, polyfills, and error/menu utilities.
- Added inline image rendering for chat messages on mobile.
- Updated mobile chat list to display newest-first to match pagination expectations.
- Committed changes locally on branch `feature/react-native-mobile-app`.
- Attempted `osascript` to trigger Automation prompt; error -10827.
- User confirmed iOS simulator issue resolved.
- Added `sign-in` screen and Clerk-based email/password + email-code flow.
- Wired chat sign-in button to `sign-in` route and added modal presentation.
- Verified `@clerk/clerk-expo` SignIn UI components are not supported on native (web-only).
- Implemented OAuth sign-in screen matching Clerk blog approach.
- Added readiness gating and `oauth-native-callback` redirect path.

Now:
- Ask user to retry; confirm Clerk redirect URLs and provider setup.

Next:
- Verify OAuth sign-in on device; adjust providers as needed.

Open questions (UNCONFIRMED if needed):
- Which OAuth providers should be shown (Google, Apple, etc.)?

Working set (files/ids/commands):
- /Users/illscience/SneakStream-ClaudeCode/CONTINUITY.md
- /Users/illscience/SneakStream-ClaudeCode/mobile/package.json
- /Users/illscience/SneakStream-ClaudeCode/mobile-backup/package.json
- /Users/illscience/SneakStream-ClaudeCode/mobile/App.tsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/index.tsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/index.web.tsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/app/_layout.jsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/app/index.jsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/app/sign-in.jsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/components/KeyboardAvoidingAnimatedView.jsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/__create/anything-menu.tsx
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/__create/polyfills.ts
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/__create/fetch.ts
- /Users/illscience/SneakStream-ClaudeCode/mobile/src/utils/auth/useAuth.js
