/**
 * Test script for Mux signed URL generation
 *
 * Usage:
 *   npx tsx scripts/test-mux-signed-url.ts [playbackId]
 *
 * If no playbackId is provided, it will use a test value.
 *
 * Before running:
 * 1. Create a signing key at https://dashboard.mux.com/settings/signing-keys
 * 2. Add to .env.local:
 *    MUX_SIGNING_KEY_ID=your-key-id
 *    MUX_SIGNING_PRIVATE_KEY=base64-encoded-private-key
 *
 * To base64 encode your private key:
 *   cat your-private-key.pem | base64 -w 0
 */

import { config } from "dotenv";
import * as jose from "jose";

// Load .env.local
config({ path: ".env.local" });

async function testSignedUrl(playbackId: string, expirationSecs: number = 7200) {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKeyBase64 = process.env.MUX_SIGNING_PRIVATE_KEY;

  console.log("\n=== Mux Signed URL Test ===\n");

  // Check configuration
  if (!keyId) {
    console.error("❌ MUX_SIGNING_KEY_ID is not set in .env.local");
    process.exit(1);
  }
  console.log("✓ MUX_SIGNING_KEY_ID:", keyId);

  if (!privateKeyBase64) {
    console.error("❌ MUX_SIGNING_PRIVATE_KEY is not set in .env.local");
    process.exit(1);
  }
  console.log("✓ MUX_SIGNING_PRIVATE_KEY: [set, length=" + privateKeyBase64.length + "]");

  // Decode and import the private key
  let privateKey: CryptoKey | import("crypto").KeyObject;
  try {
    const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
    console.log("\nDecoded PEM (first 50 chars):", privateKeyPem.substring(0, 50) + "...");

    // Handle both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
    if (privateKeyPem.includes("BEGIN RSA PRIVATE KEY")) {
      // PKCS#1 format - use Node's crypto
      const crypto = await import("crypto");
      privateKey = crypto.createPrivateKey(privateKeyPem);
      console.log("✓ Private key imported successfully (PKCS#1 format)");
    } else {
      // PKCS#8 format
      privateKey = await jose.importPKCS8(privateKeyPem, "RS256");
      console.log("✓ Private key imported successfully (PKCS#8 format)");
    }
  } catch (error) {
    console.error("❌ Failed to import private key:", error);
    console.error("\nMake sure your private key is:");
    console.error("  1. A valid RSA private key in PEM format");
    console.error("  2. Base64 encoded (cat key.pem | base64 -w 0)");
    process.exit(1);
  }

  // Generate the signed URL
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirationSecs;

  try {
    const token = await new jose.SignJWT({
      sub: playbackId,
      aud: "v",
      exp: exp,
      kid: keyId,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: keyId })
      .sign(privateKey);

    const signedUrl = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;

    console.log("\n✓ JWT token generated successfully!");
    console.log("\n--- Token Details ---");
    console.log("Playback ID:", playbackId);
    console.log("Expires:", new Date(exp * 1000).toISOString());
    console.log("Token length:", token.length);

    console.log("\n--- Signed URL ---");
    console.log(signedUrl);

    console.log("\n--- Test the URL ---");
    console.log("1. Open the URL in a browser or video player");
    console.log("2. Or test with curl:");
    console.log(`   curl -I "${signedUrl}"`);

    // Verify the token structure
    const parts = token.split(".");
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      console.log("\n--- Decoded Token ---");
      console.log("Header:", JSON.stringify(header, null, 2));
      console.log("Payload:", JSON.stringify(payload, null, 2));
    }

    return signedUrl;
  } catch (error) {
    console.error("❌ Failed to generate JWT:", error);
    process.exit(1);
  }
}

// Get playback ID and optional expiration from command line
const playbackId = process.argv[2] || "YOUR_PLAYBACK_ID_HERE";
const defaultExpiry = parseInt(process.env.MUX_TOKEN_EXPIRY_SECS || "28800", 10);
const expirationSecs = parseInt(process.argv[3]) || defaultExpiry;

if (playbackId === "YOUR_PLAYBACK_ID_HERE") {
  console.log("\n⚠️  No playback ID provided. Using placeholder.");
  console.log("   Usage: npx tsx scripts/test-mux-signed-url.ts <playbackId> [expirationSecs]");
  console.log("   Example: npx tsx scripts/test-mux-signed-url.ts abc123 60  (1 minute token)");
  console.log("   You can find playback IDs in your Convex videos table or Mux dashboard.\n");
}

testSignedUrl(playbackId, expirationSecs);
