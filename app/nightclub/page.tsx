"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface Avatar {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  image: string
  speedMultiplier: number
  paused?: boolean
  subject: string // Added subject to track avatar type for AI conversations
}

interface WaitingAvatar {
  id: string
  image: string
  subject: string
}

interface ConversationCard {
  id: string
  avatar1: { id: string; image: string }
  avatar2: { id: string; image: string }
  conversation: string
  timestamp: number
}

export default function NightclubPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [waitingAvatars, setWaitingAvatars] = useState<WaitingAvatar[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAvatar, setDialogAvatar] = useState<{ id: string; image: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [conversationCards, setConversationCards] = useState<ConversationCard[]>([])
  const animationRef = useRef<number>()
  const conversationPairsRef = useRef<Set<string>>(new Set())

  const CANVAS_SIZE = 700
  const AVATAR_SIZE = 60
  const DJ_BOOTH_SIZE = 100
  const BASE_SPEED = 1.5
  const PROXIMITY_THRESHOLD = 100

  const subjects = [
    "1980s california surfer man with sun-bleached blonde hair, retro aviator sunglasses, neon pink wetsuit, beach vibes, vintage film photography, golden hour lighting",
    "1980s california surfer woman with long flowing brown hair, retro cat-eye sunglasses, colorful floral bikini, beach aesthetic, vintage film style, warm tones",
    "golden retriever wearing neon green sunglasses facing camera front view, 1980s california beach aesthetic, retro style, warm lighting",
    "cool orange tabby cat wearing purple sunglasses facing camera front view, 1980s california beach vibes, retro photography style",
    "tropical parrot wearing pink sunglasses facing camera front view, 1980s california surf aesthetic, bright colors, retro style",
    "dolphin wearing blue sunglasses facing camera front view, 1980s california beach theme, vintage photography",
    "1980s california surfer man with dark curly hair, retro round sunglasses, yellow and blue wetsuit, beach vibes, vintage film",
    "1980s california surfer woman with short blonde hair, retro square sunglasses, neon orange bikini, beach aesthetic, vintage style",
    "sea otter wearing red sunglasses facing camera front view, 1980s california beach aesthetic, retro photography",
    "penguin wearing yellow sunglasses facing camera front view, 1980s california surf theme, bright retro colors",
    "1980s california surfer man with long hair, retro mirrored sunglasses, green wetsuit, beach vibes, vintage film photography",
    "1980s california surfer woman with braided hair, retro heart-shaped sunglasses, purple bikini, beach aesthetic, vintage style",
    "husky dog wearing cyan sunglasses facing camera front view, 1980s california beach aesthetic, retro style",
    "siamese cat wearing orange sunglasses facing camera front view, 1980s california beach vibes, retro photography",
    "macaw parrot wearing blue sunglasses facing camera front view, 1980s california surf aesthetic, bright retro colors",
  ]

  const generateSingleAvatar = async (subject: string, id: string): Promise<WaitingAvatar> => {
    try {
      const response = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: subject }),
      })
      const data = await response.json()

      return {
        id,
        image: data.imageUrl || `/placeholder.svg?height=60&width=60&query=${subject}`,
        subject,
      }
    } catch (error) {
      console.error("[v0] Error generating avatar:", error)
      return {
        id,
        image: `/placeholder.svg?height=60&width=60&query=${subject}`,
        subject,
      }
    }
  }

  useEffect(() => {
    const generateAvatars = async () => {
      setIsGenerating(true)

      const waitingPromises = Array.from({ length: 12 }, async (_, i) => {
        const subject = subjects[i % subjects.length]
        return generateSingleAvatar(subject, `waiting-${i}`)
      })

      const generatedWaiting = await Promise.all(waitingPromises)
      setWaitingAvatars(generatedWaiting)
      setIsGenerating(false)
    }

    generateAvatars()
  }, [])

  const releaseAvatar = async (waitingAvatar: WaitingAvatar) => {
    const speedMultiplier = 0.6 + Math.random() * 1.2

    const newAvatar: Avatar = {
      id: `avatar-${Date.now()}`,
      x: Math.random() * (CANVAS_SIZE - AVATAR_SIZE - 100) + 50,
      y: 20,
      vx: (Math.random() - 0.5) * BASE_SPEED * 2 * speedMultiplier,
      vy: BASE_SPEED * speedMultiplier,
      image: waitingAvatar.image,
      speedMultiplier,
      subject: waitingAvatar.subject, // Store subject for AI conversation generation
    }

    setAvatars((prev) => [...prev, newAvatar])

    setWaitingAvatars((prev) => prev.filter((a) => a.id !== waitingAvatar.id))

    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)]
    const newWaitingAvatar = await generateSingleAvatar(randomSubject, `waiting-${Date.now()}`)
    setWaitingAvatars((prev) => [...prev, newWaitingAvatar])
  }

  const createConversationCard = async (avatar1: Avatar, avatar2: Avatar) => {
    const pairKey = [avatar1.id, avatar2.id].sort().join("-")

    if (conversationPairsRef.current.has(pairKey)) {
      return
    }

    conversationPairsRef.current.add(pairKey)

    setTimeout(() => {
      conversationPairsRef.current.delete(pairKey)
    }, 10000)

    // Generate AI conversation
    try {
      const response = await fetch("/api/generate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar1Subject: avatar1.subject,
          avatar2Subject: avatar2.subject,
        }),
      })
      const data = await response.json()

      const newCard: ConversationCard = {
        id: `conv-${Date.now()}`,
        avatar1: { id: avatar1.id, image: avatar1.image },
        avatar2: { id: avatar2.id, image: avatar2.image },
        conversation: data.conversation || "Dude, the vibes here are totally rad!",
        timestamp: Date.now(),
      }

      setConversationCards((prev) => [newCard, ...prev].slice(0, 10))
    } catch (error) {
      console.error("[v0] Error creating conversation card:", error)
    }
  }

  useEffect(() => {
    const animate = () => {
      setAvatars((prevAvatars) => {
        const newAvatars = prevAvatars.map((avatar) => {
          if (avatar.paused) {
            return avatar
          }

          let { x, y, vx, vy, speedMultiplier } = avatar

          x += vx
          y += vy

          if (x <= 0 || x >= CANVAS_SIZE - AVATAR_SIZE) {
            vx = -vx * 0.98
            x = Math.max(0, Math.min(CANVAS_SIZE - AVATAR_SIZE, x))
          }
          if (y <= 0 || y >= CANVAS_SIZE - AVATAR_SIZE) {
            vy = -vy * 0.98
            y = Math.max(0, Math.min(CANVAS_SIZE - AVATAR_SIZE, y))
          }

          const djCenterX = CANVAS_SIZE / 2
          const djCenterY = CANVAS_SIZE / 2
          const avatarCenterX = x + AVATAR_SIZE / 2
          const avatarCenterY = y + AVATAR_SIZE / 2
          const dx = avatarCenterX - djCenterX
          const dy = avatarCenterY - djCenterY
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < DJ_BOOTH_SIZE / 2 + AVATAR_SIZE / 2) {
            const angle = Math.atan2(dy, dx)
            const overlap = DJ_BOOTH_SIZE / 2 + AVATAR_SIZE / 2 - distance
            x += Math.cos(angle) * overlap
            y += Math.sin(angle) * overlap
            vx = Math.cos(angle) * BASE_SPEED * speedMultiplier
            vy = Math.sin(angle) * BASE_SPEED * speedMultiplier
          }

          return { ...avatar, x, y, vx, vy }
        })

        for (let i = 0; i < newAvatars.length; i++) {
          for (let j = i + 1; j < newAvatars.length; j++) {
            const a1 = newAvatars[i]
            const a2 = newAvatars[j]
            const dx = a1.x + AVATAR_SIZE / 2 - (a2.x + AVATAR_SIZE / 2)
            const dy = a1.y + AVATAR_SIZE / 2 - (a2.y + AVATAR_SIZE / 2)
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < PROXIMITY_THRESHOLD && distance > AVATAR_SIZE) {
              createConversationCard(a1, a2)
            }

            if (distance < AVATAR_SIZE) {
              const angle = Math.atan2(dy, dx)
              const overlap = AVATAR_SIZE - distance
              newAvatars[i].x += (Math.cos(angle) * overlap) / 2
              newAvatars[i].y += (Math.sin(angle) * overlap) / 2
              newAvatars[j].x -= (Math.cos(angle) * overlap) / 2
              newAvatars[j].y -= (Math.sin(angle) * overlap) / 2

              const tempVx = newAvatars[i].vx
              const tempVy = newAvatars[i].vy
              newAvatars[i].vx = newAvatars[j].vx * 0.98
              newAvatars[i].vy = newAvatars[j].vy * 0.98
              newAvatars[j].vx = tempVx * 0.98
              newAvatars[j].vy = tempVy * 0.98
            }
          }
        }

        return newAvatars
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const handleAvatarClick = (avatarId: string) => {
    const avatar = avatars.find((a) => a.id === avatarId)
    if (avatar) {
      setDialogAvatar({ id: avatar.id, image: avatar.image })
      setDialogOpen(true)
      setSelectedAvatar(avatar.image)

      setAvatars((prev) => prev.map((a) => (a.id === avatarId ? { ...a, paused: true } : a)))
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    if (dialogAvatar) {
      setAvatars((prev) => prev.map((a) => (a.id === dialogAvatar.id ? { ...a, paused: false } : a)))
    }
    setDialogAvatar(null)
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-[#c4ff0e]">Nightclub Avatar Simulation</h1>
            <Link
              href="/chat"
              className="flex items-center gap-2 px-4 py-2 bg-[#c4ff0e] text-black rounded-lg hover:bg-[#b3e60d] transition-colors font-medium"
            >
              <span className="text-lg">💬</span>
              Chat View
            </Link>
          </div>
          <p className="text-gray-400 mb-2">
            Click avatars in the row below to release them into the nightclub. Click bouncing avatars to select them!
          </p>
          {isGenerating && <div className="text-[#c4ff0e] mb-2">Generating unique 80s surf avatars...</div>}
          {selectedAvatar && (
            <div className="flex items-center gap-2">
              <span className="text-[#ff00ff]">Your selected avatar:</span>
              <img
                src={selectedAvatar || "/placeholder.svg"}
                alt="Selected"
                className="w-10 h-10 rounded-full border-2 border-[#ff00ff]"
              />
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
          <div className="flex items-center gap-1 text-[#c4ff0e] font-bold whitespace-nowrap mr-2">
            <span className="text-lg">💬</span>
            RELEASE AVATARS
          </div>
          <div className="flex gap-3">
            {waitingAvatars.map((avatar) => (
              <div
                key={avatar.id}
                className="cursor-pointer transition-all hover:scale-110 flex-shrink-0"
                onClick={() => releaseAvatar(avatar)}
              >
                <div
                  className="w-16 h-16 rounded-full border-2 border-[#ff00ff] overflow-hidden"
                  style={{
                    boxShadow: "0 0 10px rgba(255, 0, 255, 0.4)",
                  }}
                >
                  <img
                    src={avatar.image || "/placeholder.svg"}
                    alt={avatar.id}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
            <div
              className="relative border-4 border-[#c4ff0e] rounded-lg overflow-hidden"
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
                boxShadow: "0 0 40px rgba(196, 255, 14, 0.3)",
              }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(#c4ff0e 1px, transparent 1px), linear-gradient(90deg, #c4ff0e 1px, transparent 1px)",
                  backgroundSize: "50px 50px",
                }}
              />

              <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#ff00ff] blur-xl animate-pulse" />
              <div
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#00ffff] blur-xl animate-pulse"
                style={{ animationDelay: "0.5s" }}
              />
              <div
                className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-[#ffff00] blur-xl animate-pulse"
                style={{ animationDelay: "1s" }}
              />
              <div
                className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-[#ff00ff] blur-xl animate-pulse"
                style={{ animationDelay: "1.5s" }}
              />

              <div
                className="absolute rounded-lg overflow-hidden shadow-lg"
                style={{
                  width: DJ_BOOTH_SIZE,
                  height: DJ_BOOTH_SIZE,
                  left: CANVAS_SIZE / 2 - DJ_BOOTH_SIZE / 2,
                  top: CANVAS_SIZE / 2 - DJ_BOOTH_SIZE / 2,
                  boxShadow: "0 0 30px rgba(196, 255, 14, 0.5)",
                }}
              >
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  src="/dj-mixing-music-at-turntables.jpg"
                >
                  <source
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    type="video/mp4"
                  />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-[#c4ff0e]/20 to-[#ff00ff]/20 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-black font-bold text-xs bg-white/80 px-2 py-1 rounded">DJ BOOTH</div>
                </div>
              </div>

              {avatars.map((avatar) => {
                return (
                  <div key={avatar.id}>
                    <div
                      className="absolute cursor-pointer transition-all hover:scale-110"
                      style={{
                        left: avatar.x,
                        top: avatar.y,
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                      }}
                      onClick={() => handleAvatarClick(avatar.id)}
                    >
                      <div
                        className="w-full h-full rounded-full border-2 border-[#c4ff0e] overflow-hidden"
                        style={{
                          boxShadow: "0 0 10px rgba(196, 255, 14, 0.4)",
                        }}
                      >
                        <img
                          src={avatar.image || "/placeholder.svg"}
                          alt={avatar.id}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-w-[300px]">
            <div className="sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💬</span>
                <h2 className="text-2xl font-bold text-[#ff00ff]">Conversation Feed</h2>
              </div>
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
                {conversationCards.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    Release avatars to see conversations appear when they get close!
                  </div>
                )}
                {conversationCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-gradient-to-br from-gray-900 to-black border-2 border-[#ff00ff] rounded-lg p-4 shadow-lg"
                    style={{ boxShadow: "0 0 15px rgba(255, 0, 255, 0.3)" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-16 h-16 rounded-full border-2 border-[#c4ff0e] overflow-hidden flex-shrink-0"
                        style={{ boxShadow: "0 0 8px rgba(196, 255, 14, 0.4)" }}
                      >
                        <img
                          src={card.avatar1.image || "/placeholder.svg"}
                          alt="Avatar 1"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-[#c4ff0e] text-2xl">↔</div>
                      <div
                        className="w-16 h-16 rounded-full border-2 border-[#c4ff0e] overflow-hidden flex-shrink-0"
                        style={{ boxShadow: "0 0 8px rgba(196, 255, 14, 0.4)" }}
                      >
                        <img
                          src={card.avatar2.image || "/placeholder.svg"}
                          alt="Avatar 2"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="bg-black/50 rounded p-3 border border-[#c4ff0e]/30">
                      <p className="text-white text-sm leading-relaxed">{card.conversation}</p>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{new Date(card.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md bg-black border-2 border-[#c4ff0e]">
          {dialogAvatar && (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-2xl font-bold text-[#c4ff0e]">Avatar Preview</h2>
              <div
                className="relative w-full aspect-square rounded-lg overflow-hidden border-4 border-[#ff00ff]"
                style={{ boxShadow: "0 0 20px rgba(255, 0, 255, 0.5)" }}
              >
                <img
                  src={dialogAvatar.image || "/placeholder.svg"}
                  alt="Full avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-gray-400 text-sm text-center">
                This avatar is paused while you view it. Close to resume movement.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
