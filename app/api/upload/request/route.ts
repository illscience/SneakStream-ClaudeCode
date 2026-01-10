import { NextRequest, NextResponse } from "next/server";
import { createDirectUpload } from "@/lib/mux";
import { requestLivepeerUpload } from "@/lib/livepeer";
import { getStreamProvider } from "@/lib/streamProvider";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    await requireAdminFromRoute();
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
    if (String(error).includes("Unauthorized") || String(error).includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Upload request error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
