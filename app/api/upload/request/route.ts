import { NextRequest, NextResponse } from "next/server";
import { createDirectUpload } from "@/lib/mux";
import { requestLivepeerUpload } from "@/lib/livepeer";
import { getStreamProvider } from "@/lib/streamProvider";

export async function POST(request: NextRequest) {
  try {
    const { name, provider: providerOverride } = await request.json();
    const provider = (providerOverride || getStreamProvider()).toLowerCase();

    if (provider === "mux") {
      const { uploadId, uploadUrl } = await createDirectUpload(name);
      return NextResponse.json({
        provider: "mux",
        uploadId,
        uploadUrl,
      });
    }

    const livepeerData = await requestLivepeerUpload(name);
    return NextResponse.json({
      provider: "livepeer",
      ...livepeerData,
    });
  } catch (error) {
    console.error("Upload request error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
