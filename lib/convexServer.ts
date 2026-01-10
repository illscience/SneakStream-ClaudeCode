import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";

export async function getAuthedConvexClient() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  return { client, clerkId: userId };
}

export async function requireAdminFromRoute() {
  const { client, clerkId } = await getAuthedConvexClient();
  const isAdmin = await client.query(api.adminSettings.checkIsAdmin, { clerkId });
  if (!isAdmin) {
    throw new Error("Unauthorized");
  }
  return { client, clerkId };
}
