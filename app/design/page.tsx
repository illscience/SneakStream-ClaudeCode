"use client"

import type React from "react"

import { useState } from "react"

export default function DesignPage() {
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null)

  const mockAvatar = "/anime-character-with-neon-pink-hair-tokyo-aestheti.jpg"
  const mockMessages = [
    { id: "1", username: "illsci", text: "hey everyone!", avatar: mockAvatar },
    { id: "2", username: "Anonymous", text: "what's up", avatar: undefined },
    { id: "3", username: "DJ_Neon", text: "loving the vibes", avatar: mockAvatar },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-[#c4ff0e] mb-2">Avatar Design Variations</h1>
        <p className="text-gray-400 mb-8">20 different interaction and layout patterns for chat avatars</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Variation 1: Horizontal Carousel (Current) */}
          <VariationCard
            number={1}
            title="Horizontal Carousel"
            description="Avatars scroll horizontally, random expiration with inline replacement"
            selected={selectedVariation === 1}
            onClick={() => setSelectedVariation(1)}
          >
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 flex-shrink-0"
                />
              ))}
            </div>
          </VariationCard>

          {/* Variation 2: Vertical Stack */}
          <VariationCard
            number={2}
            title="Vertical Stack"
            description="Avatars stack vertically on the side, new ones push from top"
            selected={selectedVariation === 2}
            onClick={() => setSelectedVariation(2)}
          >
            <div className="flex flex-col gap-2 h-48 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                />
              ))}
            </div>
          </VariationCard>

          {/* Variation 3: Grid Layout */}
          <VariationCard
            number={3}
            title="Compact Grid"
            description="Avatars in a 3x3 grid, random cells regenerate"
            selected={selectedVariation === 3}
            onClick={() => setSelectedVariation(3)}
          >
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                />
              ))}
            </div>
          </VariationCard>

          {/* Variation 4: Floating Bubbles */}
          <VariationCard
            number={4}
            title="Floating Bubbles"
            description="Avatars float around randomly, click to catch and select"
            selected={selectedVariation === 4}
            onClick={() => setSelectedVariation(4)}
          >
            <div className="relative h-32">
              <div className="absolute top-2 left-4 w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute top-12 right-8 w-10 h-10 rounded-full border-2 border-[#ff00ff] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute bottom-4 left-12 w-9 h-9 rounded-full border-2 border-[#00ffff] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
            </div>
          </VariationCard>

          {/* Variation 5: Circular Orbit */}
          <VariationCard
            number={5}
            title="Circular Orbit"
            description="Avatars orbit around the chat title in a circle"
            selected={selectedVariation === 5}
            onClick={() => setSelectedVariation(5)}
          >
            <div className="relative h-32 flex items-center justify-center">
              <div className="text-[#c4ff0e] text-sm">LIVE CHAT</div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
            </div>
          </VariationCard>

          {/* Variation 6: Slot Machine */}
          <VariationCard
            number={6}
            title="Slot Machine"
            description="Three vertical reels that spin, click to stop and select"
            selected={selectedVariation === 6}
            onClick={() => setSelectedVariation(6)}
          >
            <div className="flex gap-4 justify-center">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 overflow-hidden h-24 border-2 border-[#c4ff0e] rounded-lg p-1"
                >
                  <div className="w-8 h-8 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
                  <div className="w-8 h-8 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
                </div>
              ))}
            </div>
          </VariationCard>

          {/* Variation 7: Inline Message Avatars */}
          <VariationCard
            number={7}
            title="Inline Message Flow"
            description="Avatars appear inline with messages, flow with chat"
            selected={selectedVariation === 7}
            onClick={() => setSelectedVariation(7)}
          >
            <div className="space-y-2">
              {mockMessages.slice(0, 2).map((msg) => (
                <div key={msg.id} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
                  <span className="text-xs text-[#c4ff0e]">{msg.username}</span>
                </div>
              ))}
            </div>
          </VariationCard>

          {/* Variation 8: Expanding Fan */}
          <VariationCard
            number={8}
            title="Expanding Fan"
            description="Avatars fan out from a single point when hovered"
            selected={selectedVariation === 8}
            onClick={() => setSelectedVariation(8)}
          >
            <div className="relative h-32 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute top-8 left-16 w-6 h-6 rounded-full border border-[#ff00ff] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 opacity-50" />
              <div className="absolute top-16 left-20 w-6 h-6 rounded-full border border-[#00ffff] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 opacity-50" />
            </div>
          </VariationCard>

          {/* Variation 9: Ticker Tape */}
          <VariationCard
            number={9}
            title="Ticker Tape"
            description="Continuous scrolling marquee of avatars, double-click to select"
            selected={selectedVariation === 9}
            onClick={() => setSelectedVariation(9)}
          >
            <div className="overflow-hidden">
              <div className="flex gap-2 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          </VariationCard>

          {/* Variation 10: Stacked Cards */}
          <VariationCard
            number={10}
            title="Stacked Cards"
            description="Avatars stack like cards, swipe to dismiss and see next"
            selected={selectedVariation === 10}
            onClick={() => setSelectedVariation(10)}
          >
            <div className="relative h-32 flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 z-30" />
              <div className="absolute w-16 h-16 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 z-20 translate-x-2 translate-y-2 opacity-70" />
              <div className="absolute w-16 h-16 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 z-10 translate-x-4 translate-y-4 opacity-40" />
            </div>
          </VariationCard>

          {/* Variation 11: Roulette Wheel */}
          <VariationCard
            number={11}
            title="Roulette Wheel"
            description="Avatars arranged in a spinning wheel, click to stop"
            selected={selectedVariation === 11}
            onClick={() => setSelectedVariation(11)}
          >
            <div className="relative h-32 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-[#c4ff0e] relative">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const angle = (i * 60 * Math.PI) / 180
                  const x = Math.cos(angle) * 35
                  const y = Math.sin(angle) * 35
                  return (
                    <div
                      key={i}
                      className="absolute w-6 h-6 rounded-full border border-[#ff00ff] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                      style={{ left: `calc(50% + ${x}px - 12px)`, top: `calc(50% + ${y}px - 12px)` }}
                    />
                  )
                })}
              </div>
            </div>
          </VariationCard>

          {/* Variation 12: Dropdown Menu */}
          <VariationCard
            number={12}
            title="Dropdown Menu"
            description="Click avatar icon to reveal dropdown list of options"
            selected={selectedVariation === 12}
            onClick={() => setSelectedVariation(12)}
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 mx-auto" />
              <div className="bg-gray-900 border border-[#c4ff0e] rounded p-2 space-y-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
                    <span className="text-xs">Option {i}</span>
                  </div>
                ))}
              </div>
            </div>
          </VariationCard>

          {/* Variation 13: Wave Pattern */}
          <VariationCard
            number={13}
            title="Wave Pattern"
            description="Avatars move in a wave motion, click at peak to select"
            selected={selectedVariation === 13}
            onClick={() => setSelectedVariation(13)}
          >
            <div className="flex gap-2 items-end h-24">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                  style={{ marginBottom: `${Math.sin(i) * 20 + 20}px` }}
                />
              ))}
            </div>
          </VariationCard>

          {/* Variation 14: Spiral Galaxy */}
          <VariationCard
            number={14}
            title="Spiral Galaxy"
            description="Avatars spiral outward from center, newest in middle"
            selected={selectedVariation === 14}
            onClick={() => setSelectedVariation(14)}
          >
            <div className="relative h-32 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute top-8 left-16 w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute top-4 right-12 w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <div className="absolute bottom-8 left-12 w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
            </div>
          </VariationCard>

          {/* Variation 15: Sidebar Panel */}
          <VariationCard
            number={15}
            title="Sidebar Panel"
            description="Dedicated sidebar with scrollable avatar grid"
            selected={selectedVariation === 15}
            onClick={() => setSelectedVariation(15)}
          >
            <div className="flex gap-2 h-32">
              <div className="w-20 bg-gray-900 border border-[#c4ff0e] rounded p-2">
                <div className="grid grid-cols-2 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1 text-xs text-gray-400">Chat area</div>
            </div>
          </VariationCard>

          {/* Variation 16: Pulse Rings */}
          <VariationCard
            number={16}
            title="Pulse Rings"
            description="Avatars pulse with expanding rings, click during pulse"
            selected={selectedVariation === 16}
            onClick={() => setSelectedVariation(16)}
          >
            <div className="flex gap-4 justify-center items-center h-24">
              {[1, 2, 3].map((i) => (
                <div key={i} className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-[#c4ff0e] animate-ping opacity-20" />
                </div>
              ))}
            </div>
          </VariationCard>

          {/* Variation 17: Hexagon Grid */}
          <VariationCard
            number={17}
            title="Hexagon Grid"
            description="Avatars in hexagonal cells, honeycomb pattern"
            selected={selectedVariation === 17}
            onClick={() => setSelectedVariation(17)}
          >
            <div className="flex flex-col gap-1 items-center">
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                  />
                ))}
              </div>
            </div>
          </VariationCard>

          {/* Variation 18: Drag and Drop */}
          <VariationCard
            number={18}
            title="Drag and Drop"
            description="Drag avatar from pool to your profile area to select"
            selected={selectedVariation === 18}
            onClick={() => setSelectedVariation(18)}
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20"
                  />
                ))}
              </div>
              <div className="border-2 border-dashed border-[#c4ff0e] rounded p-2 text-center text-xs text-gray-400">
                Drop here
              </div>
            </div>
          </VariationCard>

          {/* Variation 19: Randomizer Button */}
          <VariationCard
            number={19}
            title="Randomizer Button"
            description="Single button that cycles through avatars rapidly"
            selected={selectedVariation === 19}
            onClick={() => setSelectedVariation(19)}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full border-2 border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20" />
              <button className="px-4 py-1 bg-[#c4ff0e] text-black rounded text-xs font-bold">RANDOMIZE</button>
            </div>
          </VariationCard>

          {/* Variation 20: Timeline Scrubber */}
          <VariationCard
            number={20}
            title="Timeline Scrubber"
            description="Horizontal timeline, scrub to preview and click to select"
            selected={selectedVariation === 20}
            onClick={() => setSelectedVariation(20)}
          >
            <div className="space-y-2">
              <div className="flex gap-1 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border border-[#c4ff0e] bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 flex-shrink-0"
                  />
                ))}
              </div>
              <div className="h-1 bg-gray-800 rounded relative">
                <div className="absolute left-1/3 w-1 h-full bg-[#c4ff0e]" />
              </div>
            </div>
          </VariationCard>
        </div>
      </div>
    </div>
  )
}

function VariationCard({
  number,
  title,
  description,
  selected,
  onClick,
  children,
}: {
  number: number
  title: string
  description: string
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-gray-900 border-2 rounded-lg p-4 text-left transition-all hover:border-[#ff00ff] ${
        selected ? "border-[#c4ff0e]" : "border-gray-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#c4ff0e] font-bold text-sm">#{number}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">{description}</p>
      <div className="bg-black rounded p-3 min-h-[120px] flex items-center justify-center">{children}</div>
    </button>
  )
}
