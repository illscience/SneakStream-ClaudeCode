"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MainNav from "@/components/navigation/MainNav";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Check if user is admin
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  // Show loading state
  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MainNav />
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
      <MainNav />

      <main className="pt-32 px-4 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Settings</h1>
          <p className="text-zinc-400">Manage site configuration and features</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">
            Admin tools will appear here as they are added.
          </p>
        </div>
      </main>
    </div>
  );
}
