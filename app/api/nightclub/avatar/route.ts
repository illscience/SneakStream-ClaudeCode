import { type NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DELETE - Delete an avatar from the pool (called when user releases to nightclub)
 * Returns success even if already deleted by another user
 */
export async function DELETE(request: NextRequest) {
  try {
    const { avatarId } = await request.json()

    if (!avatarId) {
      return NextResponse.json({ error: "Avatar ID required" }, { status: 400 })
    }

    console.log(`[AVATAR_DELETE] Deleting avatar: ${avatarId}`)

    await convex.mutation(api.avatarQueue.deleteAvatar, {
      id: avatarId as Id<"avatarPool">,
    })

    console.log(`[AVATAR_DELETE] Successfully deleted avatar: ${avatarId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Already deleted or other error - still return success
    console.log(`[AVATAR_DELETE] Avatar already deleted or error (ignoring):`, error)
    return NextResponse.json({ success: true })
  }
}

