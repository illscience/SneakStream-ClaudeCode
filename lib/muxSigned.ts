import * as jose from "jose";

// Default token expiry: 8 hours (28800 seconds), configurable via env
const DEFAULT_TOKEN_EXPIRY_SECS = parseInt(
  process.env.MUX_TOKEN_EXPIRY_SECS || "28800",
  10
);

let signingKeyId: string | null = null;
let signingPrivateKey: CryptoKey | null = null;
let signingKeyInitialized = false;

async function initSigningKey(): Promise<void> {
  if (signingKeyInitialized) {
    return;
  }

  signingKeyInitialized = true;

  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKeyBase64 = process.env.MUX_SIGNING_PRIVATE_KEY;

  if (!keyId || !privateKeyBase64) {
    console.warn(
      "MUX_SIGNING_KEY_ID or MUX_SIGNING_PRIVATE_KEY not configured. Signed playback will not be available."
    );
    return;
  }

  signingKeyId = keyId;

  // Decode the base64 private key
  const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString(
    "utf-8"
  );

  // Handle both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
  if (privateKeyPem.includes("BEGIN RSA PRIVATE KEY")) {
    // PKCS#1 format - need to use crypto.createPrivateKey to convert
    const crypto = await import("crypto");
    const keyObject = crypto.createPrivateKey(privateKeyPem);
    signingPrivateKey = keyObject as unknown as CryptoKey;
  } else {
    // PKCS#8 format - can use jose directly
    signingPrivateKey = await jose.importPKCS8(privateKeyPem, "RS256");
  }
}

export async function isSignedPlaybackAvailable(): Promise<boolean> {
  await initSigningKey();
  return signingKeyId !== null && signingPrivateKey !== null;
}

export async function generateSignedPlaybackUrl(
  playbackId: string,
  expirationSecs: number = DEFAULT_TOKEN_EXPIRY_SECS
): Promise<string> {
  await initSigningKey();

  if (!signingKeyId || !signingPrivateKey) {
    throw new Error(
      "Mux signing keys not configured. Please set MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirationSecs;

  // Create the JWT token for Mux signed URLs
  const token = await new jose.SignJWT({
    sub: playbackId,
    aud: "v",
    exp: exp,
    kid: signingKeyId,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: signingKeyId })
    .sign(signingPrivateKey);

  // Return the signed URL
  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}

export async function generateSignedThumbnailUrl(
  playbackId: string,
  expirationSecs: number = DEFAULT_TOKEN_EXPIRY_SECS
): Promise<string> {
  await initSigningKey();

  if (!signingKeyId || !signingPrivateKey) {
    throw new Error(
      "Mux signing keys not configured. Please set MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirationSecs;

  const token = await new jose.SignJWT({
    sub: playbackId,
    aud: "t", // "t" for thumbnail
    exp: exp,
    kid: signingKeyId,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: signingKeyId })
    .sign(signingPrivateKey);

  return `https://image.mux.com/${playbackId}/thumbnail.png?token=${token}`;
}
