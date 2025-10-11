import { NextResponse } from "next/server";
import { getCurrentViewers } from "@/lib/mux";
import { getStreamProvider } from "@/lib/streamProvider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playbackId = searchParams.get("playbackId");

  if (!playbackId) {
    return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
  }

  const provider = getStreamProvider();

  // Only Mux supports real-time viewer metrics
  if (provider !== "mux") {
    return NextResponse.json({ viewers: 0, provider }, { status: 200 });
  }

  try {
    const viewers = await getCurrentViewers(playbackId);
    return NextResponse.json({ viewers, provider }, { status: 200 });
  } catch (error) {
    console.error("Error fetching viewer count:", error);
    return NextResponse.json({ error: "Failed to fetch viewer count" }, { status: 500 });
  }
}
