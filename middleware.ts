import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define the home page and nightclub-related APIs as public routes (allow viewing without login)
const isPublicRoute = createRouteMatcher(['/', '/api/nightclub/(.*)', '/api/generate-polaroid'])

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except the home page
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
