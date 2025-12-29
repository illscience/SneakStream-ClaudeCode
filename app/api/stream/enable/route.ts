import { NextRequest, NextResponse } from "next/server";
import { enableLiveStream } from "@/lib/mux";

export async function POST(request: NextRequest) {
  try {
    const { streamId } = await request.json();

    if (!streamId) {
      return NextResponse.json({ error: "Missing streamId" }, { status: 400 });
    }

    await enableLiveStream(streamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[stream/enable] Failed to enable live stream:", error);
    return NextResponse.json(
      { error: "Failed to enable live stream", details: String(error) },
      { status: 500 }
    );
  }
}
