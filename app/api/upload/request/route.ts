import { NextRequest, NextResponse } from "next/server";
import { createDirectUpload } from "@/lib/mux";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const { uploadId, uploadUrl } = await createDirectUpload(name);

    return NextResponse.json({
      provider: "mux",
      uploadId,
      uploadUrl,
    });
  } catch (error) {
    console.error("Upload request error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
