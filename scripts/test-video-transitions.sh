#!/bin/bash
#
# Interactive test: Video state transitions on mobile
# (replay → PPV gate → purchased → "live" → stream ends → replay)
#
# Usage:
#   ./scripts/test-video-transitions.sh
#
# Press ESC at any prompt to abort and auto-cleanup.
#
# Prerequisites:
#   - Expo running on iOS simulator: cd mobile && npx expo start --ios --clear
#   - Next.js dev server running: npm run dev
#   - Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe
#   - Convex dev server: npx convex dev
#   - Signed in as test user on simulator (illscience+testuser@gmail.com / 123@abcDJSNEAK)
#
# What this tests:
#   Step 1: Baseline — recorded video playing with progress bar
#   Step 2: PPV livestream starts → gate replaces video area
#   Step 3: Purchase PPV → gate drops (manual Stripe checkout on device)
#   Step 4: Stream goes "live" → playbackUrl added, LIVE badge appears
#   Step 5: Stream ends → back to recorded video loop
#

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

ADMIN_IDENTITY='{"subject": "user_37iEeq0OjrRQgO7jLOU884ygane", "issuer": "https://adjusted-arachnid-92.clerk.accounts.dev"}'
TEST_USER_ID="user_39mVq47kiBw3gLO7NrymZmeoOw9"
STREAM_ID=""  # Set after stream creation, used by cleanup

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

header() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check() {
  echo -e "  ${GREEN}✓${NC} $1"
}

look_for() {
  echo -e "  ${YELLOW}👀 Look for:${NC} $1"
}

warn() {
  echo -e "  ${RED}⚠${NC}  $1"
}

# Suppress stderr from npx convex run (noisy npm warnings)
convex_run() {
  npx convex run "$@" 2>/dev/null
}

# ─── Cleanup function ────────────────────────────────────────────────────────

do_cleanup() {
  echo ""
  header "Cleaning up..."

  # End any active stream we created
  if [ -n "$STREAM_ID" ]; then
    echo "  Revoking test user entitlement..."
    convex_run "entitlements:revokeEntitlement" \
      "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}" 2>/dev/null || true

    echo "  Ending stream $STREAM_ID..."
    convex_run "livestream:endStream" \
      "{\"streamId\": \"$STREAM_ID\"}" \
      --identity "$ADMIN_IDENTITY" 2>/dev/null || true
  fi

  # Also check for any other active streams (in case STREAM_ID wasn't set yet)
  LEFTOVER=$(convex_run "livestream:getActiveStream" '{}' 2>/dev/null || echo "")
  if [ -n "$LEFTOVER" ] && [ "$LEFTOVER" != "null" ]; then
    LEFTOVER_ID=$(echo "$LEFTOVER" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])" 2>/dev/null || echo "")
    if [ -n "$LEFTOVER_ID" ] && [ "$LEFTOVER_ID" != "$STREAM_ID" ]; then
      echo "  Ending leftover stream $LEFTOVER_ID..."
      convex_run "entitlements:revokeEntitlement" \
        "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$LEFTOVER_ID\"}" 2>/dev/null || true
      convex_run "livestream:endStream" \
        "{\"streamId\": \"$LEFTOVER_ID\"}" \
        --identity "$ADMIN_IDENTITY" 2>/dev/null || true
    fi
  fi

  check "Cleanup complete — no active test streams"
}

# ─── Pause with ESC detection ────────────────────────────────────────────────

pause() {
  echo ""
  echo -e "  ${BOLD}Press Enter to continue, or ESC to abort and cleanup...${NC}"

  while true; do
    # Read a single character with no echo, 0.1s timeout for escape sequences
    IFS= read -r -s -n 1 key

    # Enter key (empty string from read)
    if [ -z "$key" ]; then
      return 0
    fi

    # ESC key (hex 1b)
    if [ "$key" = $'\x1b' ]; then
      # Consume any remaining escape sequence chars (arrow keys etc)
      read -r -s -n 2 -t 0.1 _ 2>/dev/null || true
      echo ""
      echo -e "  ${RED}${BOLD}Aborted by user (ESC)${NC}"
      do_cleanup
      exit 0
    fi
  done
}

# ─── Trap: cleanup on Ctrl-C or unexpected exit ──────────────────────────────

trap 'echo ""; echo -e "  ${RED}${BOLD}Interrupted${NC}"; do_cleanup; exit 1' INT TERM

# ─── Test account credentials ─────────────────────────────────────────────────

header "Test Account Credentials"
echo ""
echo -e "  ${BOLD}Email:${NC}    illscience+testuser@gmail.com"
echo -e "  ${BOLD}Password:${NC} 123@abcDJSNEAK"
echo -e "  ${BOLD}Stripe:${NC}   4242 4242 4242 4242 (any expiry/CVC/ZIP)"
echo ""

# ─── Pre-flight: clean up any leftover active streams ─────────────────────────

header "Pre-flight check"
EXISTING=$(convex_run "livestream:getActiveStream" '{}')
if [ "$EXISTING" != "null" ] && [ -n "$EXISTING" ]; then
  EXISTING_ID=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])")
  EXISTING_TITLE=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
  warn "Active stream found: \"$EXISTING_TITLE\" ($EXISTING_ID)"
  echo -e "  Cleaning up..."
  convex_run "entitlements:revokeEntitlement" \
    "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$EXISTING_ID\"}" || true
  convex_run "livestream:endStream" \
    "{\"streamId\": \"$EXISTING_ID\"}" \
    --identity "$ADMIN_IDENTITY" || true
  check "Cleaned up old stream"
  echo "  Waiting 2s for Convex to propagate..."
  sleep 2
else
  check "No active stream — clean slate"
fi

# ─── Step 1: Baseline ────────────────────────────────────────────────────────

header "Step 1: Baseline — Recorded video playing"
echo ""
echo "  The mobile app should be showing a recorded/default video."
echo ""
look_for "Video playing in the player area"
look_for "Progress bar advancing under the video"
look_for "Time counter incrementing (e.g. 1:23 / 3:45)"
look_for "No LIVE badge in the header"
look_for "NOW PLAYING section shows the video title"
echo ""
echo "  activeStream = null, isLive = false"
pause

# ─── Step 2: PPV livestream starts ────────────────────────────────────────────

header "Step 2: Start PPV livestream (no playbackUrl)"
echo ""
echo "  Creating a PPV stream at \$9.99 with no playbackUrl..."
echo "  (This simulates a stream announcement before going live)"
echo ""

# Start stream (no playbackUrl → PPV gate shows but no live video)
STREAM_ID=$(convex_run "livestream:startStream" \
  '{"title": "DJ Sneak Test Stream", "silent": true}' \
  --identity "$ADMIN_IDENTITY" | tr -d '"')

# Update price to $9.99
convex_run "livestream:updateStreamPrice" \
  "{\"streamId\": \"$STREAM_ID\", \"price\": 999}" \
  --identity "$ADMIN_IDENTITY" > /dev/null

check "Stream created: $STREAM_ID"
check "Visibility: ppv, Price: \$9.99"
echo ""
look_for "PPV gate replaces the video area"
look_for "Lock icon with \$9.99 price"
look_for "\"Unlock Stream\" button"
look_for "Video player should be HIDDEN behind the gate"
look_for "No LIVE badge (no playbackUrl yet)"
echo ""
echo "  activeStream.visibility = 'ppv', activeStream.playbackUrl = undefined"
echo "  isLive = false (!!undefined = false)"
pause

# ─── Step 3: Purchase PPV ────────────────────────────────────────────────────

header "Step 3: Purchase PPV — Tap 'Unlock Stream' on device"
echo ""
echo -e "  ${BOLD}Action required on device:${NC}"
echo "    1. Tap 'Unlock Stream' button"
echo "    2. Complete Stripe checkout with test card: 4242 4242 4242 4242"
echo "       - Any future expiry, any CVC, any ZIP"
echo "    3. Wait for redirect back to app"
echo ""
echo "  The Stripe webhook will fire → entitlement granted → gate drops"
echo ""
look_for "Stripe checkout opens (in-app browser)"
look_for "After payment: gate drops, video area visible again"
look_for "Since there's no playbackUrl, video falls back to recorded/default"
look_for "Progress bar and time counter resume"
echo ""
echo "  hasBundledEntitlement = true, but isLive still = false"
echo "  (stream has no playbackUrl → currentVideo falls back to recorded)"

echo ""
echo "  Alternatively, to skip Stripe and grant entitlement directly:"
echo -e "  ${CYAN}npx convex run entitlements:grantEntitlement '{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\", \"grantedBy\": \"test-script\"}'${NC}"
pause

# Verify entitlement
HAS_ENT=$(convex_run "entitlements:hasBundledEntitlement" \
  "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}")
if [ "$HAS_ENT" = "true" ]; then
  check "Test user has entitlement — gate should be dropped"
else
  warn "Test user does NOT have entitlement yet"
  echo "  If you haven't purchased yet, do so now and press Enter."
  echo "  Or grant manually with the command above."
  pause
  # Re-check
  HAS_ENT=$(convex_run "entitlements:hasBundledEntitlement" \
    "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}")
  if [ "$HAS_ENT" = "true" ]; then
    check "Entitlement confirmed"
  else
    warn "Still no entitlement — continuing anyway (gate will still be visible)"
  fi
fi

# ─── Step 4: Go "live" — add playbackUrl ─────────────────────────────────────

header "Step 4: Stream goes LIVE — adding playbackUrl"
echo ""
echo "  Fetching a real HLS URL from the default video to simulate live..."

# Get the default video's playbackUrl to use as our "live" source
DEFAULT_VIDEO_URL=$(convex_run "videos:getDefaultVideo" '{}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('playbackUrl','') if d else '')")

if [ -z "$DEFAULT_VIDEO_URL" ]; then
  # Try public videos as fallback
  DEFAULT_VIDEO_URL=$(convex_run "videos:getPublicVideos" '{"limit": 1}' | \
    python3 -c "import sys,json; vids=json.load(sys.stdin); print(vids[0].get('playbackUrl','') if vids else '')")
fi

if [ -z "$DEFAULT_VIDEO_URL" ]; then
  warn "Could not find a video with playbackUrl to simulate live stream"
  echo "  You can manually set one:"
  echo "  npx convex run livestream:updateStreamPlaybackUrl '{\"streamId\": \"$STREAM_ID\", \"playbackUrl\": \"YOUR_HLS_URL\"}' --identity '$ADMIN_IDENTITY'"
  pause
else
  echo "  Using URL: ${DEFAULT_VIDEO_URL:0:80}..."
  echo ""

  # Patch the livestream to add a playbackUrl
  convex_run "livestream:updateStreamPlaybackUrl" \
    "{\"streamId\": \"$STREAM_ID\", \"playbackUrl\": \"$DEFAULT_VIDEO_URL\"}" \
    --identity "$ADMIN_IDENTITY" > /dev/null

  check "playbackUrl set on livestream"
fi

echo ""
look_for "LIVE badge appears in the header (red pill with white dot)"
look_for "Player switches to the 'live' source"
look_for "isLive = true → player.loop should be false (but see known issue below)"
echo ""
warn "Known issue: player.loop is set in the setup callback (line 218), not reactively."
echo "  If transitioning from recorded→live, loop may stay true."
echo "  The video will still play but may loop when it shouldn't."
echo "  Fix: add useEffect to sync player.loop = !isLive"
pause

# ─── Step 5: Stream ends ─────────────────────────────────────────────────────

header "Step 5: Stream ends — back to recorded video"
echo ""
echo "  Ending stream..."

convex_run "livestream:endStream" \
  "{\"streamId\": \"$STREAM_ID\"}" \
  --identity "$ADMIN_IDENTITY" > /dev/null

check "Stream ended"
STREAM_ID=""  # Clear so cleanup doesn't try to end it again
echo ""
look_for "LIVE badge disappears from header"
look_for "Video switches back to recorded/default content"
look_for "Progress bar reappears and works"
look_for "Time counter resumes"
look_for "No black screen or freeze (brief loading spinner OK)"
echo ""
echo "  activeStream = null, isLive = false"
echo "  Player falls back to playbackState.video → defaultVideo → publicVideos[0]"
echo ""
warn "Known issue: Brief loading spinner may flash while videoSource transitions null→recorded URL"
warn "Known issue: player.loop may still be false from the live state (needs reactive sync)"
pause

# ─── Cleanup ──────────────────────────────────────────────────────────────────

header "Cleanup"
echo ""
echo "  Revoking test user entitlement..."
convex_run "entitlements:revokeEntitlement" \
  "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}" || true
check "Entitlement revoked (or was already absent)"

# Verify clean state
FINAL_STREAM=$(convex_run "livestream:getActiveStream" '{}')
if [ "$FINAL_STREAM" = "null" ] || [ -z "$FINAL_STREAM" ]; then
  check "No active stream — clean state restored"
else
  warn "Active stream still found (may have been a different one)"
fi

echo ""
header "Test Complete"
echo ""
echo "  Summary of transitions tested:"
echo "    1. Recorded video playing (baseline)"
echo "    2. PPV gate appears (startStream with no playbackUrl)"
echo "    3. PPV purchased → gate drops (Stripe or manual grant)"
echo "    4. Stream goes live → LIVE badge, new video source"
echo "    5. Stream ends → back to recorded video"
echo ""
echo "  Known issues to fix:"
echo "    - player.loop not reactive (set in setup callback only)"
echo "    - Brief loading flash on live→recorded transition"
echo ""
