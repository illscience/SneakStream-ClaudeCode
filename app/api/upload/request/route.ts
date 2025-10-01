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

    const response = await fetch(
      "https://livepeer.studio/api/asset/request-upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Livepeer API error:", errorText);
      return NextResponse.json(
        { error: "Failed to request upload URL", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log the response for debugging
    console.log("Livepeer asset creation response:", JSON.stringify(data, null, 2));
    console.log("Asset ID:", data.asset?.id);
    console.log("TUS Endpoint:", data.tusEndpoint);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Upload request error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
