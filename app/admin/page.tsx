"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MainNav from "@/components/navigation/MainNav";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? {} : "skip"
  );

  const admins = useQuery(
    api.adminSettings.getAdmins,
    isAdmin && user?.id ? {} : "skip"
  );

  const searchResults = useQuery(
    api.adminSettings.searchUsersForAdmin,
    isAdmin && user?.id && searchTerm.trim().length > 0
      ? { searchTerm }
      : "skip"
  );

  const setAdminStatus = useMutation(api.adminSettings.setAdminStatus);

  const adminIds = useMemo(() => new Set(admins?.map((admin) => admin.clerkId)), [admins]);

  // Redirect if not admin
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdminToggle = async (targetClerkId: string, nextIsAdmin: boolean) => {
    setIsUpdating(true);
    try {
      if (!user?.id) {
        throw new Error("Not authenticated");
      }
      await setAdminStatus({ targetClerkId, isAdmin: nextIsAdmin });
      showNotification(nextIsAdmin ? "Admin access granted" : "Admin access revoked");
    } catch (error) {
      console.error("Admin update error:", error);
      alert(error instanceof Error ? error.message : "Failed to update admin status");
    } finally {
      setIsUpdating(false);
    }
  };

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

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-lime-400 text-black px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
            {notification}
          </div>
        </div>
      )}

      <main className="pt-32 px-4 lg:px-8 max-w-5xl mx-auto pb-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Settings</h1>
          <p className="text-zinc-400">Manage administrator access</p>
        </div>

        <div className="grid gap-6">
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Current Admins</h2>
            {!admins || admins.length === 0 ? (
              <p className="text-sm text-zinc-500">No admins found.</p>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div key={admin.clerkId} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-800/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {admin.imageUrl ? (
                        <img
                          src={admin.imageUrl}
                          alt={admin.alias}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-semibold">
                          {(admin.alias || "A").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{admin.alias}</p>
                        <p className="text-xs text-zinc-500">{admin.email || "No email"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdminToggle(admin.clerkId, false)}
                      disabled={isUpdating}
                      className="flex items-center gap-2 rounded-full border border-red-500/60 px-4 py-2 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <ShieldOff className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Add or Remove Admins</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by alias or email"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white focus:border-lime-400 focus:outline-none"
              />
            </div>

            {!searchTerm.trim() ? (
              <p className="text-sm text-zinc-500">Search for a user to grant or revoke admin access.</p>
            ) : !searchResults || searchResults.length === 0 ? (
              <p className="text-sm text-zinc-500">No users found.</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => {
                  const currentlyAdmin = adminIds.has(result.clerkId);
                  return (
                    <div key={result.clerkId} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-800/70 px-4 py-3">
                      <div className="flex items-center gap-3">
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.alias}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-semibold">
                            {(result.alias || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{result.alias}</p>
                          <p className="text-xs text-zinc-500">{result.email || "No email"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAdminToggle(result.clerkId, !currentlyAdmin)}
                        disabled={isUpdating}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          currentlyAdmin
                            ? "border-red-500/60 text-red-400 hover:border-red-400 hover:text-red-300"
                            : "border-lime-400/60 text-lime-300 hover:border-lime-300 hover:text-lime-200"
                        }`}
                      >
                        {currentlyAdmin ? (
                          <>
                            <ShieldOff className="h-4 w-4" />
                            Remove
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Make Admin
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
