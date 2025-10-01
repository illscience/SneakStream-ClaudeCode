"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-sm">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <div className="grid grid-cols-3 gap-1 w-8 h-8">
          <div className="bg-yellow-400 rounded-sm"></div>
          <div className="bg-pink-400 rounded-sm"></div>
          <div className="bg-cyan-400 rounded-sm"></div>
          <div className="bg-green-400 rounded-sm"></div>
          <div className="bg-purple-400 rounded-sm"></div>
          <div className="bg-orange-400 rounded-sm"></div>
          <div className="bg-red-400 rounded-sm"></div>
          <div className="bg-blue-400 rounded-sm"></div>
          <div className="bg-lime-400 rounded-sm"></div>
        </div>
        <span className="text-xl font-bold text-white">DJ SNEAK</span>
      </button>
      {title && <h1 className="text-xl font-bold text-white">{title}</h1>}
      <div className="w-32" /> {/* Spacer for centering */}
    </header>
  );
}
