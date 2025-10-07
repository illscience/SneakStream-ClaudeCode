import { NextRequest, NextResponse } from "next/server";
import { createLiveStream as createMuxLiveStream } from "@/lib/mux";
import { createLivepeerStream } from "@/lib/livepeer";
import { getStreamProvider } from "@/lib/streamProvider";

export async function POST(request: NextRequest) {
  try {
    const { name, provider: providerOverride } = await request.json();
    const provider = (providerOverride || getStreamProvider()).toLowerCase();

    if (provider === "mux") {
      const stream = await createMuxLiveStream(name);
      return NextResponse.json({
        provider: "mux",
        streamId: stream.liveStreamId,
        streamKey: stream.streamKey,
        playbackId: stream.playbackId,
        playbackUrl: stream.playbackUrl,
        rtmpIngestUrl: stream.rtmpIngestUrl,
      });
    }

    const livepeerStream = await createLivepeerStream(name);
    return NextResponse.json({
      provider: "livepeer",
      streamId: livepeerStream.id,
      streamKey: livepeerStream.streamKey,
      playbackId: livepeerStream.playbackId,
      playbackUrl: livepeerStream.playbackUrl || `https://livepeercdn.studio/hls/${livepeerStream.playbackId}/index.m3u8`,
      rtmpIngestUrl: `rtmp://rtmp.livepeer.com/live`,
    });
  } catch (error) {
    console.error("Stream creation error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
