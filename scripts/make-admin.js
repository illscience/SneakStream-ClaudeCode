// One-time script to make a user an admin
// Usage: node scripts/make-admin.js YOUR_CLERK_USER_ID

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in environment");
  process.exit(1);
}

const clerkId = process.argv[2];

if (!clerkId) {
  console.error("Usage: node scripts/make-admin.js YOUR_CLERK_USER_ID");
  console.error("\nTo find your Clerk ID:");
  console.error("1. Sign in to the app");
  console.error("2. Open browser console");
  console.error("3. Run: console.log(document.cookie)");
  console.error("4. Look for your Clerk user ID in the cookies");
  process.exit(1);
}

async function makeAdmin() {
  const { ConvexHttpClient } = await import("convex/browser");
  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log(`Making user ${clerkId} a super_admin...`);

    const result = await client.mutation("admin:grantAdmin", {
      clerkId: clerkId,
      role: "super_admin",
      grantedBy: "system",
    });

    console.log("✓ Success! User is now a super_admin");
    console.log("Admin ID:", result);
  } catch (error) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

makeAdmin();
