"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"

type AvatarCarouselProps = {
  onAvatarSelect: (avatarUrl: string) => void
}

type AvatarItem = {
  id: string
  url: string | null
  isGenerating: boolean
  isExpiring?: boolean
}

export function AvatarCarousel({ onAvatarSelect }: AvatarCarouselProps) {
  const [avatars, setAvatars] = useState<AvatarItem[]>([])
  const [isInitializing, setIsInitializing] = useState(true)

  // Generate a new avatar
  const generateAvatar = useCallback(async () => {
    const prompts = [
      // Men
      "portrait of a cool 1980s California surfer man with sun-bleached blonde hair, retro sunglasses, neon wetsuit, beach vibes, vintage film photography style",
      "1980s surf culture portrait, tanned male surfer with long hair, colorful board shorts, palm trees, golden hour lighting, retro aesthetic",
      "80s California beach portrait, male surfer with headband, vintage surfboard, neon pink and teal colors, sunset vibes, film grain",
      "retro 1980s male surfer portrait, athletic build, windswept hair, classic Ray-Ban sunglasses, orange and yellow sunset, beach lifestyle",

      // Women
      "portrait of a cool 1980s California surfer woman with sun-kissed hair, retro sunglasses, colorful bikini, beach vibes, vintage film photography style",
      "1980s surf culture portrait, athletic female surfer with wavy hair, neon wetsuit, palm trees, golden hour lighting, retro aesthetic",
      "80s California beach portrait, woman surfer with headband, vintage surfboard, neon pink and teal colors, sunset vibes, film grain",
      "retro 1980s female surfer portrait, tanned skin, windswept blonde hair, classic aviator sunglasses, orange and yellow sunset, beach lifestyle",

      // Cool Animals
      "portrait of a cool golden retriever wearing retro sunglasses, facing camera, front view, 1980s California beach vibes, surfboard, neon colors, vintage film photography style",
      "1980s surf culture portrait, laid-back cat wearing aviator sunglasses, facing camera directly, front view, beach background, palm trees, golden hour lighting, retro aesthetic",
      "80s California beach portrait, parrot with colorful feathers wearing tiny sunglasses, facing camera, front view, vintage surfboard, neon pink and teal colors, sunset vibes",
      "retro 1980s portrait, cool dolphin wearing sunglasses, facing camera, front view, California beach aesthetic, orange and yellow colors, film grain",
      "portrait of a sea otter wearing sunglasses and a headband, facing camera, front view, 1980s California surf style, beach vibes, neon colors, vintage film photography",
      "1980s surf culture portrait, penguin with retro sunglasses, facing camera directly, front view, surfboard, beach background, golden hour lighting, retro aesthetic",
    ]

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

    try {
      const response = await fetch("/api/nightclub/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: randomPrompt }),
      })

      if (!response.ok) throw new Error("Failed to generate avatar")

      const data = await response.json()
      return data.imageUrl
    } catch (error) {
      console.error("[v0] Error generating avatar:", error)
      return null
    }
  }, [])

  // Initialize with 12 avatars
  useEffect(() => {
    const initializeAvatars = async () => {
      const initialAvatars: AvatarItem[] = Array(12)
        .fill(null)
        .map((_, i) => ({
          id: `avatar-${Date.now()}-${i}`,
          url: null,
          isGenerating: true,
        }))

      setAvatars(initialAvatars)

      // Generate all initial avatars
      const generatedAvatars = await Promise.all(
        initialAvatars.map(async (avatar) => ({
          ...avatar,
          url: await generateAvatar(),
          isGenerating: false,
        })),
      )

      setAvatars(generatedAvatars)
      setIsInitializing(false)
    }

    initializeAvatars()
  }, [generateAvatar])

  // Shift avatars every 5 seconds
  useEffect(() => {
    if (isInitializing) return

    const interval = setInterval(async () => {
      // Select a random avatar index to expire
      const randomIndex = Math.floor(Math.random() * avatars.length)

      setAvatars((prev) => {
        const updated = [...prev]
        if (updated.length > 0 && updated[randomIndex]) {
          updated[randomIndex] = { ...updated[randomIndex], isExpiring: true }
        }
        return updated
      })

      setTimeout(async () => {
        // Replace the expiring avatar with a new generating one
        setAvatars((prev) => {
          const updated = [...prev]
          updated[randomIndex] = {
            id: `avatar-${Date.now()}`,
            url: null,
            isGenerating: true,
          }
          return updated
        })

        // Generate the new avatar
        const newUrl = await generateAvatar()
        setAvatars((prev) => {
          const updated = [...prev]
          if (updated[randomIndex]) {
            updated[randomIndex] = {
              ...updated[randomIndex],
              url: newUrl,
              isGenerating: false,
            }
          }
          return updated
        })
      }, 1000)
    }, 5000)

    return () => clearInterval(interval)
  }, [isInitializing, generateAvatar, avatars.length])

  const handleAvatarClick = (avatar: AvatarItem) => {
    if (avatar.url && !avatar.isGenerating) {
      onAvatarSelect(avatar.url)
      // Remove the clicked avatar
      setAvatars((prev) => prev.filter((a) => a.id !== avatar.id))
    }
  }

  return (
    <div className="flex-1 flex items-center gap-2 overflow-hidden">
      <div className="flex gap-2 transition-all duration-500">
        {avatars.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => handleAvatarClick(avatar)}
            disabled={avatar.isGenerating || !avatar.url}
            className={`relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 hover:border-[#ff00ff] transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed animate-in slide-in-from-right ${
              avatar.isExpiring ? "border-[#c4ff0e] animate-expire" : "border-[#c4ff0e]"
            }`}
          >
            {avatar.isGenerating || !avatar.url ? (
              <div className="w-full h-full bg-gradient-to-br from-[#c4ff0e]/20 to-[#ff00ff]/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#c4ff0e] animate-spin" />
              </div>
            ) : (
              <img src={avatar.url || "/placeholder.svg"} alt="Avatar option" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
