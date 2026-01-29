import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";

export async function getAuthedConvexClient() {
  const { userId, getToken } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Get Clerk JWT token and pass to Convex for auth
  const token = await getToken({ template: "convex" });
  if (token) {
    client.setAuth(token);
  }

  return { client, clerkId: userId };
}

export async function requireAdminFromRoute() {
  const { client, clerkId } = await getAuthedConvexClient();
  // checkIsAdmin now uses ctx.auth, so we pass empty object
  const isAdmin = await client.query(api.adminSettings.checkIsAdmin, {});
  if (!isAdmin) {
    throw new Error("Unauthorized");
  }
  return { client, clerkId };
}
