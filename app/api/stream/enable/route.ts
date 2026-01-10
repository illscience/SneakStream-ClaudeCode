import { NextRequest, NextResponse } from "next/server";
import { enableLiveStream } from "@/lib/mux";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    await requireAdminFromRoute();
    const { streamId } = await request.json();

    if (!streamId) {
      return NextResponse.json({ error: "Missing streamId" }, { status: 400 });
    }

    await enableLiveStream(streamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[stream/enable] Failed to enable live stream:", error);
    return NextResponse.json(
      { error: "Failed to enable live stream", details: String(error) },
      { status: 500 }
    );
  }
}
