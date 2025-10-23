"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MainNav from "@/components/navigation/MainNav";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [layoutMode, setLayoutMode] = useState<"classic" | "theater">("theater");

  // Check if user is admin
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Get current setting
  const showNightclubOnHome = useQuery(
    api.adminSettings.getSetting,
    { key: "showNightclubOnHome" }
  );

  // Update setting mutation
  const updateSetting = useMutation(api.adminSettings.updateSetting);

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  // Load layout mode from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem("layoutMode");
    if (saved === "classic" || saved === "theater") {
      setLayoutMode(saved);
    }
  }, []);

  const handleToggle = async () => {
    if (!user?.id) return;
    
    try {
      await updateSetting({
        clerkId: user.id,
        key: "showNightclubOnHome",
        value: !showNightclubOnHome,
      });
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  };

  // Show loading state
  if (!isLoaded || isAdmin === undefined || showNightclubOnHome === undefined) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-xl text-zinc-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MainNav layoutMode={layoutMode} onLayoutChange={setLayoutMode} />

      <main className="pt-32 px-4 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Settings</h1>
          <p className="text-zinc-400">Manage site configuration and features</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="space-y-6">
            {/* Nightclub Homepage Setting */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">
                  Show Nightclub on Homepage
                </h3>
                <p className="text-sm text-zinc-400">
                  When enabled, the nightclub simulation will appear on the homepage.
                  This does not affect the dedicated /nightclub page.
                </p>
              </div>
              <button
                onClick={handleToggle}
                className={`ml-6 relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                  showNightclubOnHome ? "bg-lime-400" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    showNightclubOnHome ? "translate-x-9" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Status indicator */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    showNightclubOnHome ? "bg-lime-400" : "bg-zinc-600"
                  }`}
                />
                <span className="text-zinc-400">
                  Nightclub is currently{" "}
                  <span className={showNightclubOnHome ? "text-lime-400" : "text-zinc-500"}>
                    {showNightclubOnHome ? "visible" : "hidden"}
                  </span>{" "}
                  on the homepage
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Note:</strong> Changes take effect
            immediately. The nightclub section will be completely removed from the DOM
            when disabled, not just hidden with CSS.
          </p>
        </div>
      </main>
    </div>
  );
}

