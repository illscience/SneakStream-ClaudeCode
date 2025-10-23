"use client"

import NightclubSimulation from "../components/NightclubSimulation"
import LiveChat from "../components/LiveChat"

export default function NightclubPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <NightclubSimulation>
          <LiveChat />
        </NightclubSimulation>
      </div>
    </div>
  )
}
