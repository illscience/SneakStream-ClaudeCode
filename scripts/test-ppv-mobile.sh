#!/bin/bash
#
# Test PPV purchase flow from mobile simulator.
#
# Usage:
#   ./scripts/test-ppv-mobile.sh setup    — Create a fake PPV livestream ($9.99)
#   ./scripts/test-ppv-mobile.sh reset    — Revoke test user's entitlement so they can re-purchase
#   ./scripts/test-ppv-mobile.sh status   — Show current active stream + test user entitlement
#   ./scripts/test-ppv-mobile.sh cleanup  — End the stream and remove entitlements
#
# Prerequisites:
#   - Next.js dev server running (port 3000)
#   - Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe
#   - Expo dev server: cd mobile && npx expo start --ios --clear
#
# Test user (dev Clerk):
#   Email:    illscience+testuser@gmail.com
#   Password: 123@abcDJSNEAK
#   Clerk ID: user_39mVq47kiBw3gLO7NrymZmeoOw9

set -euo pipefail

ADMIN_CLERK_ID="user_37iEeq0OjrRQgO7jLOU884ygane"
ADMIN_IDENTITY='{"subject": "user_37iEeq0OjrRQgO7jLOU884ygane", "issuer": "https://adjusted-arachnid-92.clerk.accounts.dev"}'
TEST_USER_ID="user_39mVq47kiBw3gLO7NrymZmeoOw9"

get_active_stream() {
  npx convex run "livestream:getActiveStream" '{}' 2>/dev/null
}

cmd_status() {
  echo "=== Active Stream ==="
  STREAM=$(get_active_stream)
  if [ "$STREAM" = "null" ] || [ -z "$STREAM" ]; then
    echo "  No active stream"
  else
    echo "$STREAM" | python3 -c "
import sys, json
s = json.load(sys.stdin)
print(f\"  ID:         {s['_id']}\")
print(f\"  Title:      {s['title']}\")
print(f\"  Visibility: {s.get('visibility', 'N/A')}\")
print(f\"  Price:      \${s.get('price', 0) / 100:.2f}\")
print(f\"  Status:     {s['status']}\")
"
    STREAM_ID=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])")

    echo ""
    echo "=== Test User Entitlement ==="
    HAS=$(npx convex run "entitlements:hasBundledEntitlement" \
      "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}" 2>/dev/null)
    if [ "$HAS" = "true" ]; then
      echo "  Has access: YES (will need 'reset' to re-test purchase)"
    else
      echo "  Has access: NO (ready to test purchase)"
    fi
  fi
}

cmd_setup() {
  STREAM=$(get_active_stream)
  if [ "$STREAM" != "null" ] && [ -n "$STREAM" ]; then
    echo "Active stream already exists:"
    echo "$STREAM" | python3 -c "
import sys, json
s = json.load(sys.stdin)
print(f\"  {s['_id']} — {s['title']} ({s.get('visibility','?')}, \${s.get('price',0)/100:.2f})\")
"
    echo ""
    echo "Run './scripts/test-ppv-mobile.sh cleanup' first to remove it,"
    echo "or './scripts/test-ppv-mobile.sh reset' to just revoke the test user's entitlement."
    return
  fi

  echo "Creating PPV livestream..."
  STREAM_ID=$(npx convex run "livestream:startStream" \
    '{"title": "PPV Test Stream", "silent": true}' \
    --identity "$ADMIN_IDENTITY" 2>/dev/null | tr -d '"')

  echo "Setting price to \$9.99..."
  npx convex run "livestream:updateStreamPrice" \
    "{\"streamId\": \"$STREAM_ID\", \"price\": 999}" \
    --identity "$ADMIN_IDENTITY" 2>/dev/null

  echo ""
  echo "PPV livestream created:"
  echo "  ID:    $STREAM_ID"
  echo "  Price: \$9.99"
  echo "  Vis:   ppv"
  echo ""
  echo "Next steps:"
  echo "  1. Make sure Next.js dev server is running (npm run dev)"
  echo "  2. Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
  echo "  3. Sign in on mobile as: illscience+testuser@gmail.com / 123@abcDJSNEAK"
  echo "  4. Tap 'Unlock Stream' and use test card 4242 4242 4242 4242"
}

cmd_reset() {
  STREAM=$(get_active_stream)
  if [ "$STREAM" = "null" ] || [ -z "$STREAM" ]; then
    echo "No active stream. Run 'setup' first."
    return 1
  fi

  STREAM_ID=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])")

  echo "Revoking test user entitlement for stream $STREAM_ID..."
  RESULT=$(npx convex run "entitlements:revokeEntitlement" \
    "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}" 2>/dev/null)

  if [ "$RESULT" = "true" ]; then
    echo "Entitlement revoked. Test user can purchase again."
  else
    echo "No entitlement found (user may not have purchased yet)."
  fi
}

cmd_cleanup() {
  STREAM=$(get_active_stream)
  if [ "$STREAM" = "null" ] || [ -z "$STREAM" ]; then
    echo "No active stream to clean up."
    return
  fi

  STREAM_ID=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])")
  TITLE=$(echo "$STREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")

  echo "Revoking test user entitlement..."
  npx convex run "entitlements:revokeEntitlement" \
    "{\"userId\": \"$TEST_USER_ID\", \"livestreamId\": \"$STREAM_ID\"}" 2>/dev/null || true

  echo "Ending stream '$TITLE' ($STREAM_ID)..."
  npx convex run "livestream:endStream" \
    "{\"streamId\": \"$STREAM_ID\"}" \
    --identity "$ADMIN_IDENTITY" 2>/dev/null

  echo "Done. Stream ended and entitlement revoked."
}

case "${1:-help}" in
  setup)   cmd_setup ;;
  reset)   cmd_reset ;;
  status)  cmd_status ;;
  cleanup) cmd_cleanup ;;
  *)
    echo "Usage: $0 {setup|reset|status|cleanup}"
    echo ""
    echo "  setup   — Create a fake PPV livestream (\$9.99)"
    echo "  reset   — Revoke test user entitlement (re-test purchase)"
    echo "  status  — Show active stream + entitlement state"
    echo "  cleanup — End stream + revoke entitlements"
    ;;
esac
