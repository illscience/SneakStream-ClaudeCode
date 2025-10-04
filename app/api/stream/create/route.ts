import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    const apiKey = process.env.LIVEPEER_STUDIO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Livepeer API key not configured" },
        { status: 500 }
      );
    }

    // Create a LivePeer stream
    const response = await fetch("https://livepeer.studio/api/stream", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        profiles: [
          {
            name: "720p",
            bitrate: 2000000,
            fps: 30,
            width: 1280,
            height: 720,
          },
          {
            name: "480p",
            bitrate: 1000000,
            fps: 30,
            width: 854,
            height: 480,
          },
          {
            name: "360p",
            bitrate: 500000,
            fps: 30,
            width: 640,
            height: 360,
          },
        ],
        record: true, // Automatically record the stream
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Livepeer API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create stream", details: errorText },
        { status: response.status }
      );
    }

    const stream = await response.json();

    // Log for debugging
    console.log("LivePeer stream created:", {
      id: stream.id,
      streamKey: stream.streamKey,
      playbackId: stream.playbackId,
    });

    return NextResponse.json({
      streamId: stream.id,
      streamKey: stream.streamKey,
      playbackId: stream.playbackId,
      rtmpIngestUrl: `rtmp://rtmp.livepeer.com/live`,
      playbackUrl: `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`,
    });
  } catch (error) {
    console.error("Stream creation error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
