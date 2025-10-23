"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Loader2, MessageSquare, Send, Trash2, X } from "lucide-react"

interface Avatar {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  image: string
  speedMultiplier: number
  paused?: boolean
  subject: string
  lastDirectionChange?: number
  targetDirection?: { vx: number; vy: number }
}

interface WaitingAvatar {
  id: string
  _id?: string // Convex document ID for deletion
  image: string | null
  subject: string
  isGenerating?: boolean
}

interface ConversationCard {
  id: string
  avatar1: { id: string; image: string }
  avatar2: { id: string; image: string }
  conversation: string
  timestamp: number
}

export default function NightclubSimulation() {
  const { user } = useUser()
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [waitingAvatars, setWaitingAvatars] = useState<WaitingAvatar[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAvatar, setDialogAvatar] = useState<{ id: string; image: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [conversationCards, setConversationCards] = useState<ConversationCard[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set())
  const [polaroid, setPolaroid] = useState<string | null>(null)
  const [generatingPolaroid, setGeneratingPolaroid] = useState(false)
  const animationRef = useRef<number>()
  const avatarsRef = useRef<Avatar[]>([])
  const frameCountRef = useRef(0)

  // Chat functionality
  const messages = useQuery(api.chat.getMessages)
  const sendMessage = useMutation(api.chat.sendMessage)
  const deleteMessage = useMutation(api.chat.deleteMessage)
  const updateUserAvatar = useMutation(api.users.updateSelectedAvatar)
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  )

  const displayName = convexUser?.alias || user?.username || user?.firstName || "Anonymous"
  const userSelectedAvatar = convexUser?.selectedAvatar || null
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "illscience@gmail.com"

  // Responsive canvas sizing
  const [isMobile, setIsMobile] = useState(false)
  const [canvasSize, setCanvasSize] = useState(700)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Make canvas responsive - smaller on mobile
      if (mobile) {
        setCanvasSize(Math.min(window.innerWidth - 32, 400))
      } else {
        setCanvasSize(700)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Sync avatarsRef with avatars state
  useEffect(() => {
    avatarsRef.current = avatars
  }, [avatars])

  const CANVAS_SIZE = canvasSize
  const AVATAR_SIZE = isMobile ? 40 : 60
  const DJ_BOOTH_SIZE = isMobile ? 60 : 100
  const BASE_SPEED = isMobile ? 1 : 1.5
  const PROXIMITY_THRESHOLD = isMobile ? 70 : 100

  const generateSingleAvatar = async (id: string): Promise<WaitingAvatar> => {
    try {
      // No prompt - let server use OpenRouter-generated prompts for variety
      const response = await fetch("/api/nightclub/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      return {
        id,
        image: data.imageUrl || `/placeholder.svg?height=60&width=60`,
        subject: data.prompt || "Anonymous",
      }
    } catch (error) {
      console.error("[v0] Error generating avatar:", error)
      return {
        id,
        image: `/placeholder.svg?height=60&width=60`,
        subject: "Error",
      }
    }
  }

  useEffect(() => {
    const loadAvatars = async () => {
      setIsGenerating(true)

      try {
        // First try to dequeue pre-generated avatars from queue
        console.log('[QUEUE] Attempting to load 12 avatars from queue...')
        const queueResponse = await fetch('/api/nightclub/queue?count=12')
        const queueData = await queueResponse.json()

        if (queueData.avatars && queueData.avatars.length > 0) {
          // Use pre-generated avatars from shared pool (deleted when released to nightclub)
          console.log(`[QUEUE] Loaded ${queueData.avatars.length} avatars from queue instantly!`)
          const queuedAvatars = queueData.avatars.map((qa: any, i: number) => ({
            id: `queued-${i}`,
            _id: qa._id, // Store Convex document ID for deletion on release
            image: qa.imageUrl,
            subject: qa.prompt.substring(0, 30),
            isGenerating: false,
          }))
          setWaitingAvatars(queuedAvatars)
          setIsGenerating(false)
          return
        }
      } catch (error) {
        console.warn('[QUEUE] Failed to load from queue, generating fresh:', error)
      }

      // Fallback: generate fresh avatars if queue is empty
      console.log('[QUEUE] Queue empty, generating 12 avatars fresh with progressive loading...')
      
      // Initialize 12 placeholder avatars with spinners
      const placeholders: WaitingAvatar[] = Array.from({ length: 12 }, (_, i) => ({
        id: `waiting-${Date.now()}-${i}`,
        image: null,
        subject: '',
        isGenerating: true,
      }))
      
      setWaitingAvatars(placeholders)
      setIsGenerating(false) // We're showing spinners, so not "initializing" anymore

      // Kick off all 12 generations in parallel
      placeholders.forEach(async (placeholder, index) => {
        const generatedAvatar = await generateSingleAvatar(placeholder.id)
        
        // Update this specific avatar in state when it completes
        setWaitingAvatars(prev => 
          prev.map(avatar => 
            avatar.id === placeholder.id 
              ? { ...generatedAvatar, isGenerating: false }
              : avatar
          )
        )
      })
    }

    loadAvatars()
  }, [])

  const releaseAvatar = async (waitingAvatar: WaitingAvatar) => {
    // Don't release avatars that are still generating
    if (waitingAvatar.isGenerating || !waitingAvatar.image) {
      return
    }

    const speedMultiplier = 0.6 + Math.random() * 1.2
    const initialAngle = Math.random() * Math.PI * 2
    const initialSpeed = BASE_SPEED * speedMultiplier

    const newAvatar: Avatar = {
      id: `avatar-${Date.now()}`,
      x: Math.random() * (CANVAS_SIZE - AVATAR_SIZE - 100) + 50,
      y: 20,
      vx: Math.cos(initialAngle) * initialSpeed,
      vy: Math.sin(initialAngle) * initialSpeed,
      image: waitingAvatar.image,
      speedMultiplier,
      subject: waitingAvatar.subject,
      lastDirectionChange: Date.now(),
      targetDirection: {
        vx: Math.cos(initialAngle) * initialSpeed,
        vy: Math.sin(initialAngle) * initialSpeed,
      },
    }

    setAvatars((prev) => [...prev, newAvatar])

    setWaitingAvatars((prev) => prev.filter((a) => a.id !== waitingAvatar.id))

    // Delete from database now that it's being used
    if (waitingAvatar._id) {
      try {
        await fetch('/api/nightclub/avatar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: waitingAvatar._id }),
        })
        console.log(`[AVATAR_DELETE] Deleted avatar ${waitingAvatar._id} from pool`)
      } catch (error) {
        console.log(`[AVATAR_DELETE] Failed to delete avatar (already deleted):`, error)
      }
    }

    // Add placeholder with spinner first
    const placeholderId = `waiting-${Date.now()}`
    setWaitingAvatars((prev) => [...prev, {
      id: placeholderId,
      image: null,
      subject: '',
      isGenerating: true,
    }])

    // Generate new waiting avatar using OpenRouter prompts
    const newWaitingAvatar = await generateSingleAvatar(placeholderId)
    setWaitingAvatars((prev) => 
      prev.map(avatar => 
        avatar.id === placeholderId 
          ? { ...newWaitingAvatar, isGenerating: false }
          : avatar
      )
    )
  }

  const generatePolaroid = async (avatar1: Avatar, avatar2: Avatar) => {
    // Check if already generating or displaying
    if (generatingPolaroid || polaroid) {
      console.log('[POLAROID] Already generating or displaying a polaroid')
      return
    }

    console.log(`[POLAROID] Sending to API:`, {
      avatar1Url: avatar1.image,
      avatar2Url: avatar2.image,
    })

    setGeneratingPolaroid(true)

    try {
      const response = await fetch("/api/generate-polaroid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar1Url: avatar1.image,
          avatar2Url: avatar2.image,
        }),
      })
      
      if (!response.ok) {
        console.error(`[POLAROID] API error: ${response.status} ${response.statusText}`)
        return
      }
      
      const data = await response.json()
      console.log('[POLAROID] Received response:', data)

      if (data.imageUrl) {
        setPolaroid(data.imageUrl)
      }
    } catch (error) {
      console.error("[Polaroid] Error generating polaroid:", error)
    } finally {
      setGeneratingPolaroid(false)
    }
  }

  const handlePolaroidDismiss = () => {
    setPolaroid(null)
  }

  useEffect(() => {
    let isRunning = true

    const animate = () => {
      if (!isRunning) return

      // Pause animation when polaroid is displayed
      if (polaroid) {
        if (isRunning) {
          animationRef.current = requestAnimationFrame(animate)
        }
        return
      }

      try {
        const now = Date.now()
        frameCountRef.current++

        const currentAvatars = avatarsRef.current
        if (!currentAvatars || currentAvatars.length === 0) {
          if (isRunning) {
            animationRef.current = requestAnimationFrame(animate)
          }
          return
        }

        const newAvatars = currentAvatars.map((avatar) => {
          if (avatar.paused) {
            return avatar
          }

          let { x, y, vx, vy, speedMultiplier, lastDirectionChange, targetDirection } = avatar

          const changeInterval = 2000 + Math.random() * 3000
          if (!lastDirectionChange || now - lastDirectionChange > changeInterval) {
            const angle = Math.random() * Math.PI * 2
            const speed = BASE_SPEED * speedMultiplier * (0.5 + Math.random() * 0.5)
            targetDirection = {
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
            }
            lastDirectionChange = now
          }

          if (targetDirection) {
            const lerpFactor = 0.02
            vx += (targetDirection.vx - vx) * lerpFactor
            vy += (targetDirection.vy - vy) * lerpFactor
          }

          x += vx
          y += vy

          if (x <= 0 || x >= CANVAS_SIZE - AVATAR_SIZE) {
            vx = -vx * 0.8
            x = Math.max(0, Math.min(CANVAS_SIZE - AVATAR_SIZE, x))
            const angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * Math.PI * 0.5
            targetDirection = {
              vx: Math.cos(angle) * BASE_SPEED * speedMultiplier,
              vy: Math.sin(angle) * BASE_SPEED * speedMultiplier,
            }
          }
          if (y <= 0 || y >= CANVAS_SIZE - AVATAR_SIZE) {
            vy = -vy * 0.8
            y = Math.max(0, Math.min(CANVAS_SIZE - AVATAR_SIZE, y))
            const angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * Math.PI * 0.5
            targetDirection = {
              vx: Math.cos(angle) * BASE_SPEED * speedMultiplier,
              vy: Math.sin(angle) * BASE_SPEED * speedMultiplier,
            }
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

            const pushAngle = angle + (Math.random() - 0.5) * 0.3
            targetDirection = {
              vx: Math.cos(pushAngle) * BASE_SPEED * speedMultiplier * 1.2,
              vy: Math.sin(pushAngle) * BASE_SPEED * speedMultiplier * 1.2,
            }
          }

          return {
            ...avatar,
            x,
            y,
            vx,
            vy,
            lastDirectionChange,
            targetDirection
          }
        })

        for (let i = 0; i < newAvatars.length; i++) {
          for (let j = i + 1; j < newAvatars.length; j++) {
            const a1 = newAvatars[i]
            const a2 = newAvatars[j]
            const dx = a1.x + AVATAR_SIZE / 2 - (a2.x + AVATAR_SIZE / 2)
            const dy = a1.y + AVATAR_SIZE / 2 - (a2.y + AVATAR_SIZE / 2)
            const distance = Math.sqrt(dx * dx + dy * dy)

            // Polaroid generation moved to manual button - no automatic generation

            if (distance < AVATAR_SIZE) {
              const angle = Math.atan2(dy, dx)
              const overlap = AVATAR_SIZE - distance

              newAvatars[i].x += (Math.cos(angle) * overlap) / 2
              newAvatars[i].y += (Math.sin(angle) * overlap) / 2
              newAvatars[j].x -= (Math.cos(angle) * overlap) / 2
              newAvatars[j].y -= (Math.sin(angle) * overlap) / 2

              const randomFactor = 0.7 + Math.random() * 0.3
              const tempVx = newAvatars[i].vx
              const tempVy = newAvatars[i].vy
              newAvatars[i].vx = newAvatars[j].vx * randomFactor
              newAvatars[i].vy = newAvatars[j].vy * randomFactor
              newAvatars[j].vx = tempVx * randomFactor
              newAvatars[j].vy = tempVy * randomFactor

              const angle1 = Math.atan2(newAvatars[i].vy, newAvatars[i].vx)
              const speed1 = Math.sqrt(newAvatars[i].vx ** 2 + newAvatars[i].vy ** 2)
              newAvatars[i].targetDirection = {
                vx: Math.cos(angle1) * speed1,
                vy: Math.sin(angle1) * speed1,
              }

              const angle2 = Math.atan2(newAvatars[j].vy, newAvatars[j].vx)
              const speed2 = Math.sqrt(newAvatars[j].vx ** 2 + newAvatars[j].vy ** 2)
              newAvatars[j].targetDirection = {
                vx: Math.cos(angle2) * speed2,
                vy: Math.sin(angle2) * speed2,
              }
            }
          }
        }

        avatarsRef.current = newAvatars

        // Update less frequently on mobile to reduce choppiness
        const updateInterval = isMobile ? 4 : 2
        if (frameCountRef.current % updateInterval === 0) {
          setAvatars([...newAvatars])
        }
      } catch (error) {
        console.error("Animation error:", error)
      }

      if (isRunning) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      isRunning = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isMobile, polaroid])

  const handleAvatarClick = async (avatarId: string) => {
    const avatar = avatars.find((a) => a.id === avatarId)
    if (avatar) {
      setDialogAvatar({ id: avatar.id, image: avatar.image })
      setDialogOpen(true)
      setAvatars((prev) => prev.map((a) => (a.id === avatarId ? { ...a, paused: true } : a)))
    }
  }

  const handleSetChatAvatar = async () => {
    if (user?.id && dialogAvatar?.image) {
      try {
        setSelectedAvatar(dialogAvatar.image)
        await updateUserAvatar({
          clerkId: user.id,
          avatarUrl: dialogAvatar.image,
        })
        setDialogOpen(false)
      } catch (error) {
        console.error("Failed to update avatar:", error)
      }
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    if (dialogAvatar) {
      setAvatars((prev) => prev.map((a) => (a.id === dialogAvatar.id ? { ...a, paused: false } : a)))
    }
    setDialogAvatar(null)
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) {
      return "just now"
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return `${mins}m ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    const messageText = newMessage.trim()
    const optimisticId = `optimistic-${Date.now()}`

    const optimisticMsg = {
      _id: optimisticId,
      _creationTime: Date.now(),
      user: user.id,
      userId: user.id,
      userName: displayName,
      avatarUrl: userSelectedAvatar || undefined,
      body: messageText,
    }

    setOptimisticMessages((prev) => [...prev, optimisticMsg])
    setNewMessage("")

    try {
      await sendMessage({
        user: user.id,
        userId: user.id,
        userName: displayName,
        avatarUrl: userSelectedAvatar || undefined,
        body: messageText,
      })
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    } catch (error) {
      console.error("Failed to send message:", error)
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== optimisticId))
    }
  }

  const handleReleaseRandom = async () => {
    // Filter out avatars that are still generating
    const readyAvatars = waitingAvatars.filter(a => !a.isGenerating && a.image)
    if (readyAvatars.length < 2) return
    
    // Release 2-5 random avatars (or all if less than 5)
    const maxToRelease = Math.min(5, readyAvatars.length)
    const numToRelease = Math.floor(Math.random() * (maxToRelease - 1)) + 2 // Min 2, max 5
    
    console.log(`[NIGHTCLUB] Releasing ${numToRelease} random avatars`)
    
    // Snapshot ready avatars and shuffle
    const shuffled = readyAvatars.sort(() => Math.random() - 0.5)
    const toRelease = shuffled.slice(0, numToRelease)
    
    // Remove from waiting list FIRST to prevent duplicates
    setWaitingAvatars(prev => prev.filter(a => !toRelease.includes(a)))
    
    // Then release all to dance floor
    toRelease.forEach(avatar => {
      // Skip if somehow the image is null (shouldn't happen due to filter above)
      if (!avatar.image) return

      const speedMultiplier = 0.6 + Math.random() * 1.2
      const initialAngle = Math.random() * Math.PI * 2
      const initialSpeed = BASE_SPEED * speedMultiplier

      const newAvatar: Avatar = {
        id: `avatar-${Date.now()}-${Math.random()}`,
        x: Math.random() * (CANVAS_SIZE - AVATAR_SIZE - 100) + 50,
        y: 20,
        vx: Math.cos(initialAngle) * initialSpeed,
        vy: Math.sin(initialAngle) * initialSpeed,
        image: avatar.image,
        speedMultiplier,
        subject: avatar.subject,
        lastDirectionChange: Date.now(),
        targetDirection: {
          vx: Math.cos(initialAngle) * initialSpeed,
          vy: Math.sin(initialAngle) * initialSpeed,
        },
      }

      setAvatars((prev) => [...prev, newAvatar])
      
      // Delete from database now that it's being used
      if (avatar._id) {
        fetch('/api/nightclub/avatar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: avatar._id }),
        }).then(() => {
          console.log(`[AVATAR_DELETE] Deleted avatar ${avatar._id} from pool`)
        }).catch((error) => {
          console.log(`[AVATAR_DELETE] Failed to delete avatar (already deleted):`, error)
        })
      }
    })
    
    // Add placeholders with spinners first
    const placeholders: WaitingAvatar[] = toRelease.map((_, i) => ({
      id: `waiting-${Date.now()}-${i}`,
      image: null,
      subject: '',
      isGenerating: true,
    }))
    
    setWaitingAvatars(prev => [...prev, ...placeholders])
    
    // Generate replacement avatars in parallel
    placeholders.forEach(async (placeholder) => {
      const newAvatar = await generateSingleAvatar(placeholder.id)
      setWaitingAvatars(prev => 
        prev.map(avatar => 
          avatar.id === placeholder.id 
            ? { ...newAvatar, isGenerating: false }
            : avatar
        )
      )
    })
  }

  const handleSnapPhoto = () => {
    if (avatars.length < 2) {
      console.log('[POLAROID] Need at least 2 avatars on dance floor')
      return
    }
    
    // Pick 2 distinct random avatars from dance floor
    const index1 = Math.floor(Math.random() * avatars.length)
    let index2 = Math.floor(Math.random() * avatars.length)
    
    // Ensure we pick two different avatars
    while (index2 === index1 && avatars.length > 1) {
      index2 = Math.floor(Math.random() * avatars.length)
    }
    
    const avatar1 = avatars[index1]
    const avatar2 = avatars[index2]
    
    console.log(`[POLAROID] Snapping photo of:`)
    console.log(`  Avatar 1: ${avatar1.subject}, Image: ${avatar1.image?.substring(0, 50)}`)
    console.log(`  Avatar 2: ${avatar2.subject}, Image: ${avatar2.image?.substring(0, 50)}`)
    
    generatePolaroid(avatar1, avatar2)
  }

  const handleDeleteWaitingAvatar = async (avatar: WaitingAvatar, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent releasing the avatar
    
    // Remove from UI immediately
    setWaitingAvatars((prev) => prev.filter((a) => a.id !== avatar.id))
    
    // Delete from database
    if (avatar._id) {
      try {
        await fetch('/api/nightclub/avatar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: avatar._id }),
        })
        console.log(`[AVATAR_DELETE] Deleted waiting avatar ${avatar._id} from pool`)
      } catch (error) {
        console.log(`[AVATAR_DELETE] Failed to delete avatar (already deleted):`, error)
      }
    }
    
    // Add placeholder with spinner first
    const placeholderId = `waiting-${Date.now()}`
    setWaitingAvatars((prev) => [...prev, {
      id: placeholderId,
      image: null,
      subject: '',
      isGenerating: true,
    }])

    // Generate replacement avatar
    const newWaitingAvatar = await generateSingleAvatar(placeholderId)
    setWaitingAvatars((prev) => 
      prev.map(a => 
        a.id === placeholderId 
          ? { ...newWaitingAvatar, isGenerating: false }
          : a
      )
    )
  }

  const readyAvatarCount = waitingAvatars.filter(a => !a.isGenerating && a.image).length

  return (
    <div className="space-y-6">
      {/* Control Buttons */}
      <div className="flex gap-4 items-center">
        <button
          onClick={handleReleaseRandom}
          disabled={readyAvatarCount < 2}
          className="bg-[#ff00ff] hover:bg-[#ff00ff]/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors"
          style={{ boxShadow: "0 0 10px rgba(255, 0, 255, 0.5)" }}
        >
          Release 2-5 Random ({readyAvatarCount} ready)
        </button>
        
        <button
          onClick={handleSnapPhoto}
          disabled={avatars.length < 2 || generatingPolaroid || polaroid !== null}
          className="bg-[#c4ff0e] hover:bg-[#d4ff3e] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-2 px-6 rounded-lg transition-colors"
        >
          {generatingPolaroid ? '⏳ Generating...' : `📸 Snap Photo (${avatars.length} on floor)`}
        </button>
      </div>

      {/* Release Avatars Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="flex items-center gap-1 text-[#c4ff0e] font-bold whitespace-nowrap mr-2">
          <span className="text-lg">💬</span>
          WAITING AREA
        </div>
        {isGenerating && <div className="text-[#c4ff0e] text-sm">Generating avatars...</div>}
        <div className="flex gap-3">
          {waitingAvatars.map((avatar) => (
            <div
              key={avatar.id}
              className={`relative transition-all flex-shrink-0 group ${
                avatar.isGenerating 
                  ? 'cursor-not-allowed' 
                  : 'cursor-pointer hover:scale-110'
              }`}
              onClick={() => !avatar.isGenerating && releaseAvatar(avatar)}
            >
              <div
                className="w-16 h-16 rounded-full border-2 border-[#ff00ff] overflow-hidden flex items-center justify-center"
                style={{ boxShadow: "0 0 10px rgba(255, 0, 255, 0.4)" }}
              >
                {avatar.isGenerating || !avatar.image ? (
                  <div className="w-full h-full bg-gradient-to-br from-[#c4ff0e]/20 to-[#ff00ff]/20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#c4ff0e] animate-spin" />
                  </div>
                ) : (
                  <img
                    src={avatar.image}
                    alt={avatar.id}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {!avatar.isGenerating && (
                <button
                  onClick={(e) => handleDeleteWaitingAvatar(avatar, e)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete avatar"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Nightclub Canvas + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Canvas */}
        <div className="relative flex justify-center lg:justify-start">
          <div style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
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
              <div className="w-full h-full bg-zinc-800" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#c4ff0e]/20 to-[#ff00ff]/20 flex items-center justify-center pointer-events-none">
                <div className="text-center text-black font-bold text-xs bg-white/80 px-2 py-1 rounded">DJ BOOTH</div>
              </div>
            </div>

            {avatars.map((avatar) => (
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
                    style={{ boxShadow: "0 0 10px rgba(196, 255, 14, 0.4)" }}
                  >
                    <img
                      src={avatar.image || "/placeholder.svg"}
                      alt={avatar.id}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Polaroid Display */}
            {polaroid && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-300">
                <div className="relative max-w-[80%] max-h-[80%]">
                  <img
                    src={polaroid}
                    alt="Polaroid"
                    className="w-full h-full object-contain rounded-lg border-4 border-white shadow-2xl"
                    style={{
                      boxShadow: "0 0 40px rgba(255, 255, 255, 0.3)",
                      maxWidth: isMobile ? "300px" : "500px",
                    }}
                  />
                  <button
                    onClick={handlePolaroidDismiss}
                    className="absolute -top-4 -right-4 bg-[#ff00ff] hover:bg-[#ff00ff]/80 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl transition-colors shadow-lg"
                    style={{ boxShadow: "0 0 20px rgba(255, 0, 255, 0.5)" }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-6 h-6 text-[#c4ff0e]" />
            <h2 className="text-2xl font-bold text-[#c4ff0e]">Live Chat</h2>
          </div>

          {userSelectedAvatar && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-gray-400">Your avatar:</span>
              <img
                src={userSelectedAvatar}
                alt="Selected"
                className="w-8 h-8 rounded-full border-2 border-[#ff00ff]"
                style={{ boxShadow: "0 0 8px rgba(255, 0, 255, 0.4)" }}
              />
              <span className="text-sm font-medium text-[#c4ff0e]">{displayName}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#c4ff0e] border border-zinc-800"
            />
            <button
              type="submit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c4ff0e] text-black transition-colors hover:bg-[#b3e60d]"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            {[...(messages || []), ...optimisticMessages]
              .filter((message) => !deletedMessageIds.has(message._id))
              .slice()
              .reverse()
              .map((message) => (
              <div key={message._id} className="flex gap-3 group">
                {message.avatarUrl && (
                  <img
                    src={message.avatarUrl}
                    alt={message.userName || "User"}
                    className="w-10 h-10 rounded-full border-2 border-[#ff00ff] flex-shrink-0"
                    style={{ boxShadow: "0 0 8px rgba(255, 0, 255, 0.4)" }}
                  />
                )}
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-[#c4ff0e]">
                      {message.userName || message.user || "Anonymous"}
                    </span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">
                      {formatTimestamp(message._creationTime)}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setDeletedMessageIds((prev) => new Set(prev).add(message._id))
                          deleteMessage({ messageId: message._id }).catch((error) => {
                            console.error("Failed to delete message:", error)
                            setDeletedMessageIds((prev) => {
                              const newSet = new Set(prev)
                              newSet.delete(message._id)
                              return newSet
                            })
                          })
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-500 ml-auto"
                        title="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white break-words">{message.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md bg-black border-2 border-[#c4ff0e]">
          {dialogAvatar && (
            <div className="flex flex-col items-center gap-4">
              <DialogTitle className="text-2xl font-bold text-[#c4ff0e]">Avatar Preview</DialogTitle>
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
              <div className="text-center space-y-2">
                <p className="text-gray-400 text-sm">
                  Set this as your chat avatar?
                </p>
                <p className="text-gray-500 text-xs">
                  All your messages will display this avatar.
                </p>
              </div>
              {user?.id && (
                <button
                  onClick={handleSetChatAvatar}
                  className="w-full bg-[#c4ff0e] text-black font-bold py-3 px-6 rounded-lg hover:bg-[#d4ff3e] transition-colors"
                >
                  Set as Chat Avatar
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
