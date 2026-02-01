"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Disc3, Clock, DollarSign, ExternalLink } from "lucide-react";
import Link from "next/link";

interface CrateSectionProps {
  userId?: string;
}

export function CrateSection({ userId }: CrateSectionProps) {
  const { user } = useUser();
  const effectiveUserId = userId || user?.id;

  const crateItems = useQuery(
    api.bidding.getUserCrate,
    effectiveUserId ? { userId: effectiveUserId } : "skip"
  );

  if (!crateItems || crateItems.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#ff00ff]/10 rounded-full flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-[#ff00ff]" />
          </div>
          <h2 className="text-xl font-bold">My Crate</h2>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Disc3 className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-500">No tracks in your crate yet</p>
          <p className="text-sm text-zinc-600 mt-2">
            Win bids during live streams to add tracks!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#ff00ff]/10 rounded-full flex items-center justify-center">
          <Disc3 className="w-5 h-5 text-[#ff00ff]" />
        </div>
        <h2 className="text-xl font-bold">My Crate ({crateItems.length})</h2>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {crateItems.map((item) => {
          // Format timestamp as mm:ss
          const minutes = Math.floor(item.videoTimestamp / 60);
          const seconds = item.videoTimestamp % 60;
          const timestampFormatted = `${minutes}:${String(seconds).padStart(2, "0")}`;

          // Format purchase date
          const purchaseDate = new Date(item.purchasedAt);
          const dateFormatted = purchaseDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <div
              key={item._id}
              className="group flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 hover:bg-zinc-800 hover:border-[#ff00ff]/30 transition-all"
            >
              {/* Vinyl icon with timestamp */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center border-2 border-[#ff00ff]/40">
                  <Disc3 className="w-7 h-7 text-[#ff00ff]" />
                </div>
                <div className="absolute -bottom-1 -right-1 rounded-full bg-[#c4ff0e] px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {timestampFormatted}
                </div>
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold truncate group-hover:text-[#ff00ff] transition-colors">
                  {item.livestreamTitle}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateFormatted}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${(item.purchaseAmount / 100).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Link to watch at timestamp (if recording available) */}
              <Link
                href={`/watch?livestream=${item.livestreamId}&t=${item.videoTimestamp}`}
                className="flex-shrink-0 rounded-lg bg-[#ff00ff]/10 px-3 py-2 text-xs font-medium text-[#ff00ff] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ff00ff]/20"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
