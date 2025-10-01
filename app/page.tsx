'use client';

import { Heart, Download, Share2, MoreHorizontal, Play, Pause, SkipBack, SkipForward, Repeat, Volume2, MessageSquare, Tv, ChevronDown } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
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
          <span className="text-xl font-bold">DJ SNEAK</span>
        </div>

        <nav className="flex gap-8 text-sm font-medium">
          <a href="#" className="text-gray-300 hover:text-white">BROWSE</a>
          <a href="#" className="text-gray-300 hover:text-white">LIVE NOW</a>
          <a href="#" className="text-gray-300 hover:text-white">EVENTS</a>
          <a href="#" className="text-gray-300 hover:text-white">MY LIBRARY</a>
          <a href="#" className="text-gray-300 hover:text-white">ABOUT</a>
        </nav>

        <div className="flex gap-3">
          <button className="px-6 py-2 bg-lime-400 text-black rounded-full font-medium hover:bg-lime-300">
            Subscribe
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:bg-gray-200">
            ×
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* DJ Hero Section */}
        <section className="relative bg-gradient-to-br from-pink-200 via-pink-300 to-pink-200 rounded-3xl mx-4 overflow-hidden">
          <div className="p-12">
            <div className="flex items-start justify-between mb-8">
              <h1 className="text-6xl font-bold text-black">DJ SNEAK</h1>
              <div className="flex gap-3">
                <button className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center hover:bg-white">
                  <Download className="w-5 h-5 text-black" />
                </button>
                <button className="px-6 py-3 bg-black/90 text-white rounded-full flex items-center gap-2 hover:bg-black">
                  <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <span className="text-black text-xs">👤</span>
                  </span>
                  <span className="text-sm font-medium">Follow Artist</span>
                </button>
              </div>
            </div>

            {/* DJ Video Player */}
            <div className="relative w-full aspect-video max-w-2xl mx-auto mb-4">
              <video
                controls
                autoPlay
                muted
                loop
                className="w-full h-full rounded-2xl bg-black"
                src="/2025_02_02_09_43_33_V1.mp4"
              />
            </div>

            {/* Live Status Bar */}
            <div className="flex items-center gap-4 bg-black/80 backdrop-blur-sm rounded-full px-6 py-3 w-fit">
              <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-black" />
              </button>
              <span className="text-sm font-medium">CHAT</span>
              <div className="flex items-center gap-2 ml-4">
                <span className="px-3 py-1 bg-gray-700 rounded-full text-xs">House Set</span>
                <span className="px-3 py-1 bg-red-600 rounded-full text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  Live
                </span>
                <span className="px-3 py-1 bg-red-600 rounded-full text-xs">2.4K Viewers</span>
                <MoreHorizontal className="w-4 h-4" />
                <button className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                  🎵
                </button>
              </div>
            </div>
          </div>

          {/* Side Action Buttons */}
          <div className="absolute right-4 bottom-24 flex flex-col gap-3">
            <button className="w-12 h-12 bg-black/80 rounded-xl flex items-center justify-center hover:bg-black">
              <span className="text-xl">👤</span>
            </button>
            <button className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center hover:bg-red-700">
              <Heart className="w-5 h-5 fill-white" />
            </button>
          </div>

          {/* Expand Button */}
          <button className="absolute bottom-4 right-12 w-12 h-12 bg-black/80 rounded-full flex items-center justify-center hover:bg-black">
            <ChevronDown className="w-5 h-5" />
          </button>
        </section>

        {/* Content Sections */}
        <div className="px-4 pb-48 pt-8 grid grid-cols-3 gap-8">
          {/* Upcoming Shows */}
          <div>
            <h3 className="text-sm text-zinc-400 mb-4">NEXT SHOW SOON</h3>
            <div className="bg-gradient-to-br from-pink-200 to-pink-300 rounded-2xl overflow-hidden">
              <div className="p-4 aspect-square bg-pink-300/50 flex items-center justify-center">
                <div className="text-black/40 text-sm">DJ Preview</div>
              </div>
              <div className="p-4 bg-black/80 backdrop-blur">
                <div className="flex items-center gap-3 mb-2">
                  <button className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                    <Play className="w-4 h-4 fill-white ml-1" />
                  </button>
                  <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400">TONIGHT 8PM PST (DOORS OPEN 7PM)</p>
              </div>
            </div>
          </div>

          {/* Sets List */}
          <div>
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-xl p-4">
                <h4 className="font-medium mb-2">Deep House Sunset Session</h4>
                <p className="text-sm text-lime-400 mb-2">Live from Ibiza Beach Club</p>
                <p className="text-xs text-zinc-500">Friday 9:00 PM - 12:00 AM EST</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <h4 className="font-medium mb-2">Techno Underground Night</h4>
                <p className="text-sm text-zinc-400 mb-2">Warehouse Rave Series</p>
                <p className="text-xs text-zinc-500">Saturday 11:00 PM - 4:00 AM EST</p>
              </div>
            </div>
          </div>

          {/* Playlist */}
          <div>
            <h3 className="text-sm text-zinc-400 mb-4">NOW PLAYING</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg"></div>
                <div className="flex-1">
                  <p className="text-xs text-lime-400 mb-1">Currently Playing</p>
                  <p className="text-xs text-zinc-400">Deep Melodic Vibes Mix</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <h4 className="font-medium mb-2">Progressive Trance Journey</h4>
                <p className="text-xs text-zinc-500">3 hours of uplifting energy</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-sm text-zinc-400 mb-2">FEATURED MIX</p>
                <h4 className="text-red-600 font-medium mb-2">Best of 2024 Year End Mix</h4>
                <p className="text-sm mb-1">Top tracks from this year</p>
                <p className="text-sm text-zinc-400">120 min duration</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <h4 className="font-medium mb-2">Liquid Drum & Bass Selection</h4>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Minimal Tech House Grooves</p>
                <p className="text-xs text-zinc-600">• 2hr 45min runtime</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4">
                <h4 className="font-medium mb-2">Ambient Chill Sessions</h4>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Audio Player Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-zinc-900 to-black border-t border-zinc-800">
        {/* Progress Bar */}
        <div className="h-1 bg-zinc-800">
          <div className="h-full w-1/3 bg-lime-400"></div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-8 py-4">
          {/* Left Controls */}
          <div className="flex items-center gap-4">
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-200">
              <Pause className="w-5 h-5 text-black" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700">
              <Heart className="w-5 h-5 fill-white" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Repeat className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Center - Now Playing */}
          <button className="px-8 py-3 bg-lime-400 text-black rounded-full font-bold hover:bg-lime-300">
            Deep Melodic Vibes Mix
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Heart className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <span className="text-sm">🌐</span>
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Pause className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Pause className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Volume2 className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MessageSquare className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Tv className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <MessageSquare className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <Tv className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Track Info Bar */}
        <div className="px-8 pb-4">
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <span>🏆</span>
              <span>🎵</span>
            </span>
            <span>HOUSE</span>
            <span>TECHNO</span>
            <span>TRANCE</span>
            <span>D&B</span>
            <span>▶</span>
            <span>⊙</span>
          </div>
        </div>
      </div>
    </div>
  );
}
