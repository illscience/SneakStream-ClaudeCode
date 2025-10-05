# DJ Sneak - Live Streaming Platform

A Next.js-based live streaming platform for DJ Sneak, featuring live streams, video on demand, and event discovery.

## Features

- 🎵 Live DJ streaming
- 📹 Video upload and library management
- ⭐ Default video playback when offline
- 💬 Real-time chat
- 🎟️ Event discovery powered by AI
- 👥 User profiles and following
- 🔐 Authentication with Clerk

## Tech Stack

- **Framework:** Next.js 15 with Turbopack
- **Video Infrastructure:** Livepeer Studio
- **Database:** Convex
- **Authentication:** Clerk
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
LIVEPEER_STUDIO_API_KEY=
NEXT_PUBLIC_LIVEPEER_STUDIO_API_KEY=
CLAUDE_API_KEY=
```

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com).

Don't forget to set your environment variables in the Vercel dashboard!
