import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const livestreamId = searchParams.get("livestreamId");

  if (!livestreamId) {
    return NextResponse.json({ error: "livestreamId is required" }, { status: 400 });
  }

  try {
    // Use entitlement count as approximate viewer count
    const viewers = await convex.query(api.entitlements.getLivestreamEntitlementCount, {
      livestreamId: livestreamId as Id<"livestreams">,
    });
    return NextResponse.json({ viewers }, { status: 200 });
  } catch (error) {
    console.error("Error fetching viewer count:", error);
    return NextResponse.json({ viewers: 0 }, { status: 200 });
  }
}
