import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/lib/mux";
import { requireAdminFromRoute } from "@/lib/convexServer";

export async function POST(request: NextRequest) {
  try {
    await requireAdminFromRoute();

    const body = await request.json();
    const assetIds = Array.isArray(body?.assetIds) ? body.assetIds : [];
    const unique = Array.from(
      new Set(assetIds.filter((id) => typeof id === "string" && id.length > 0))
    );

    const valid: string[] = [];
    const invalid: string[] = [];
    const errors: Array<{ assetId: string; error: string }> = [];

    for (const assetId of unique) {
      if (!assetId || assetId.startsWith("pending:")) {
        invalid.push(assetId);
        continue;
      }

      try {
        await getAsset(assetId);
        valid.push(assetId);
      } catch (error) {
        const message = String(error);
        if (message.includes("(404)") || message.includes("not_found")) {
          invalid.push(assetId);
        } else {
          errors.push({ assetId, error: message });
        }
      }
    }

    return NextResponse.json({ valid, invalid, errors });
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes("Unauthorized") || errorStr.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error", details: errorStr },
      { status: 500 }
    );
  }
}
