# TODO

## Stripe Integration

- [ ] Add Stripe test keys to `.env.local`
- [ ] Run `npx convex dev` to push schema changes
- [ ] Test tip flow end-to-end
- [ ] Test PPV purchase flow end-to-end

## Mux Signed Playback

- [ ] **Test automatic token refresh on desktop and mobile**
  - Verify that when a signed token expires mid-playback, the player automatically fetches a new token
  - Test on Chrome, Safari, Firefox (desktop)
  - Test on iOS Safari and Android Chrome (mobile)
  - Use short token expiry (60-120 seconds) via `MUX_TOKEN_EXPIRY_SECS` to trigger refresh during playback
  - Confirm video continues without interruption or user action

- [ ] Implement token refresh callback in Mux Player component
- [ ] Add signed playback policy option to livestream creation

## General

- [ ] Update CLAUDE.md with new environment variables
- [ ] Add Stripe webhook endpoint to Vercel deployment
