import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { assetId } = await request.json();

    const apiKey = process.env.LIVEPEER_STUDIO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Livepeer API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://livepeer.studio/api/asset/${assetId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Livepeer API error:", errorText);
      return NextResponse.json(
        { error: "Failed to get asset status", details: errorText },
        { status: response.status }
      );
    }

    const asset = await response.json();
    return NextResponse.json(asset);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
