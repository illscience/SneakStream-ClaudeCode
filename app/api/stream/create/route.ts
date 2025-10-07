import { NextRequest, NextResponse } from "next/server";
import { createLiveStream } from "@/lib/mux";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const stream = await createLiveStream(name);

    return NextResponse.json({
      provider: "mux",
      streamId: stream.liveStreamId,
      streamKey: stream.streamKey,
      playbackId: stream.playbackId,
      playbackUrl: stream.playbackUrl,
      rtmpIngestUrl: stream.rtmpIngestUrl,
    });
  } catch (error) {
    console.error("Stream creation error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
