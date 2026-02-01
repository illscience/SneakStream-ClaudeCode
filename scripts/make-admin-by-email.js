#!/usr/bin/env node
// One-time script to make a user an admin by email
// Usage: node scripts/make-admin-by-email.js email@example.com

import { config } from "dotenv";
config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/make-admin-by-email.js email@example.com");
  process.exit(1);
}

async function makeAdmin() {
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api.js");

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log(`Looking for user with email: ${email}...`);

    // First, get the user by email using a direct query
    const users = await client.query(api.users.getAllUsers);
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.error(`✗ User not found with email: ${email}`);
      console.log("Available users:", users?.map(u => u.email).filter(Boolean).join(", "));
      process.exit(1);
    }

    console.log(`Found user: ${user.alias} (${user.clerkId})`);
    console.log(`Current admin status: ${user.isAdmin ? "Yes" : "No"}`);

    if (user.isAdmin) {
      console.log("✓ User is already an admin!");
      process.exit(0);
    }

    // We need to patch directly - let's add a helper mutation
    console.log("\nTo make this user an admin, run this in the Convex dashboard:");
    console.log(`\nIn Functions > users, run a mutation to patch the user document with isAdmin: true`);
    console.log(`Or use: npx convex run --no-push 'users:makeAdminByEmail' '{"email": "${email}"}'`);

  } catch (error) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

makeAdmin();
