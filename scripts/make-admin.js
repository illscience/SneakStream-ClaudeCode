// Script to grant or revoke admin privileges for a user
// Usage: node scripts/make-admin.js YOUR_CLERK_USER_ID [--revoke]

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in environment");
  console.error("Make sure to run with: npx dotenv -e .env.local -- node scripts/make-admin.js <clerkId>");
  process.exit(1);
}

const clerkId = process.argv[2];
const shouldRevoke = process.argv.includes("--revoke");

if (!clerkId || clerkId.startsWith("--")) {
  console.error("Usage: node scripts/make-admin.js YOUR_CLERK_USER_ID [--revoke]");
  console.error("\nTo find a Clerk ID:");
  console.error("1. Go to Clerk Dashboard > Users");
  console.error("2. Click on the user");
  console.error("3. Copy the User ID (starts with 'user_')");
  console.error("\nExamples:");
  console.error("  npx dotenv -e .env.local -- node scripts/make-admin.js user_abc123");
  console.error("  npx dotenv -e .env.local -- node scripts/make-admin.js user_abc123 --revoke");
  process.exit(1);
}

async function makeAdmin() {
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api.js");
  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    const action = shouldRevoke ? "Revoking admin from" : "Granting admin to";
    console.log(`${action} user ${clerkId}...`);

    const result = await client.mutation(api.adminSettings.setAdminStatus, {
      targetClerkId: clerkId,
      isAdmin: !shouldRevoke,
    });

    const status = shouldRevoke ? "no longer an admin" : "now an admin";
    console.log(`✓ Success! User is ${status}`);
    console.log("Result:", result);
  } catch (error) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

makeAdmin();
