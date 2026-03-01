import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.warn("Missing EXPO_PUBLIC_CONVEX_URL environment variable");
}

export const convex = new ConvexReactClient(CONVEX_URL || "");
