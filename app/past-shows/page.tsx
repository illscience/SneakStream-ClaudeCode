"use client";

import MainNav from "@/components/navigation/MainNav";
import PastShows from "../components/PastShows";

export default function PastShowsPage() {
  return (
    <div className="min-h-dvh bg-black text-white">
      <MainNav />
      <main className="pt-24 pb-24">
        <div className="px-4 lg:px-8 mb-6">
          <div className="flex justify-center">
            <div className="max-w-6xl w-full">
              <h1 className="text-3xl lg:text-4xl font-bold">Past Shows</h1>
              <p className="text-zinc-400 mt-2">Watch previous DJ sets and live sessions.</p>
            </div>
          </div>
        </div>
        <PastShows />
      </main>
    </div>
  );
}
