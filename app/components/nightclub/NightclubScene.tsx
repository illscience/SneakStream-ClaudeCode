"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Grid } from "@react-three/drei";
import type { Id } from "@/convex/_generated/dataModel";
import clsx from "clsx";
import * as THREE from "three";

export interface NightclubAvatarDoc {
  _id: Id<"nightclubAvatars">;
  aliasSnapshot: string;
  imageUrl?: string | null;
  seed: number;
  prompt?: string | null;
}

export interface EncounterHandler {
  (avatarA: Id<"nightclubAvatars">, avatarB: Id<"nightclubAvatars">): void;
}

interface NightclubSceneProps {
  avatars: NightclubAvatarDoc[];
  onEncounter: EncounterHandler;
  onSelect?: (avatarId: Id<"nightclubAvatars">) => void;
  selectedId?: Id<"nightclubAvatars"> | null;
  className?: string;
}

interface AvatarSimState {
  id: Id<"nightclubAvatars">;
  alias: string;
  imageUrl?: string | null;
  prompt?: string | null;
  seed: number;
  color: string;
  radius: number;
  position: [number, number];
  velocity: [number, number];
}

const FLOOR_SIZE = 12; // world units (square)
const BASE_SPEED = 1.6;
const COLLISION_COOLDOWN_MS = 30_000;

const createRng = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const buildSimState = (avatar: NightclubAvatarDoc): AvatarSimState => {
  const rng = createRng(avatar.seed ?? 1);
  const radius = 0.75 + rng() * 0.35;
  const pos: [number, number] = [
    (rng() - 0.5) * (FLOOR_SIZE - radius * 4),
    (rng() - 0.5) * (FLOOR_SIZE - radius * 4),
  ];
  const angle = rng() * Math.PI * 2;
  const speed = BASE_SPEED * (0.65 + rng() * 0.55);
  const velocity: [number, number] = [Math.cos(angle) * speed, Math.sin(angle) * speed];
  const accentHue = Math.floor(rng() * 360);
  const color = `hsl(${accentHue}, 92%, 58%)`;

  return {
    id: avatar._id,
    alias: avatar.aliasSnapshot,
    imageUrl: avatar.imageUrl ?? undefined,
    prompt: avatar.prompt ?? undefined,
    seed: avatar.seed,
    color,
    radius,
    position: pos,
    velocity,
  };
};

const AvatarBubble = ({
  state,
  isSelected,
  onSelect,
}: {
  state: AvatarSimState;
  isSelected: boolean;
  onSelect?: (id: Id<"nightclubAvatars">) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetPosRef = useRef<[number, number]>([0, 0]);

  useFrame((_, delta) => {
    // Smoothly interpolate to target position for fluid movement
    const [x, y] = state.position;
    targetPosRef.current = [x, y];
    
    if (groupRef.current) {
      const current = groupRef.current.position;
      const lerpFactor = Math.min(delta * 12, 1); // Smooth interpolation
      current.x += (x - current.x) * lerpFactor;
      current.y += (y - current.y) * lerpFactor;
      current.z = 0;
    }
  });

  const accentClass = useMemo(() => {
    const borderColor = state.color;
    return {
      boxShadow: `0 0 18px ${borderColor}80`,
      border: `2px solid ${borderColor}`,
    } satisfies React.CSSProperties;
  }, [state.color]);

  return (
    <group ref={groupRef}>
      <Html
        transform
        occlude
        center
        className="pointer-events-auto"
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect?.(state.id);
        }}
      >
        <div
          className={clsx(
            "relative flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 backdrop-blur",
            isSelected ? "ring-4 ring-lime-400" : "ring-2 ring-white/20"
          )}
          style={accentClass}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-black/60" />
          {state.imageUrl ? (
            <img
              src={state.imageUrl}
              alt={state.alias}
              className="relative h-14 w-14 rounded-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-lime-400/80 via-fuchsia-500/80 to-sky-500/80 text-sm font-semibold text-black">
              {state.alias.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

const SimulationLoop = ({
  statesRef,
  onEncounter,
}: {
  statesRef: React.MutableRefObject<Map<string, AvatarSimState>>;
  onEncounter: EncounterHandler;
}) => {
  const cooldownRef = useRef<Map<string, number>>(new Map());

  useFrame((_, delta) => {
    const states = Array.from(statesRef.current.values());
    const halfSize = FLOOR_SIZE / 2;

    for (const state of states) {
      const [vx, vy] = state.velocity;
      state.position[0] += vx * delta;
      state.position[1] += vy * delta;

      const maxX = halfSize - state.radius;
      const maxY = halfSize - state.radius;

      if (state.position[0] > maxX) {
        state.position[0] = maxX;
        state.velocity[0] = -Math.abs(state.velocity[0]);
      } else if (state.position[0] < -maxX) {
        state.position[0] = -maxX;
        state.velocity[0] = Math.abs(state.velocity[0]);
      }

      if (state.position[1] > maxY) {
        state.position[1] = maxY;
        state.velocity[1] = -Math.abs(state.velocity[1]);
      } else if (state.position[1] < -maxY) {
        state.position[1] = -maxY;
        state.velocity[1] = Math.abs(state.velocity[1]);
      }

      // Introduce gentle drift to avoid repetitive loops
      state.velocity[0] += (Math.random() - 0.5) * delta * 0.12;
      state.velocity[1] += (Math.random() - 0.5) * delta * 0.12;
    }

    // Collision detection
    for (let i = 0; i < states.length; i++) {
      const a = states[i];
      for (let j = i + 1; j < states.length; j++) {
        const b = states[j];
        const dx = a.position[0] - b.position[0];
        const dy = a.position[1] - b.position[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = a.radius + b.radius + 0.35;

        if (distance < minDistance) {
          // Simple elastic bounce
          const angle = Math.atan2(dy, dx);
          const speedA = Math.hypot(...a.velocity);
          const speedB = Math.hypot(...b.velocity);
          a.velocity[0] = Math.cos(angle) * speedA;
          a.velocity[1] = Math.sin(angle) * speedA;
          b.velocity[0] = -Math.cos(angle) * speedB;
          b.velocity[1] = -Math.sin(angle) * speedB;

          const now = Date.now();
          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          const lastHit = cooldownRef.current.get(pairKey) ?? 0;
          if (now - lastHit > COLLISION_COOLDOWN_MS) {
            cooldownRef.current.set(pairKey, now);
            onEncounter(a.id, b.id);
          }
        }
      }
    }
  });

  return null;
};

export const NightclubScene = ({
  avatars,
  onEncounter,
  onSelect,
  selectedId,
  className,
}: NightclubSceneProps) => {
  const [simStates, setSimStates] = useState<AvatarSimState[]>([]);
  const statesRef = useRef<Map<string, AvatarSimState>>(new Map());
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const activeIds = new Set<string>();

    console.log(`[NightclubScene] Total avatars received: ${avatars.length}`);
    console.log(`[NightclubScene] Avatars:`, avatars.map(a => ({ id: a._id, alias: a.aliasSnapshot, hasImage: !!a.imageUrl })));

    avatars
      .filter((avatar) => avatar.imageUrl)
      .forEach((avatar) => {
        activeIds.add(avatar._id);
        if (!statesRef.current.has(avatar._id)) {
          statesRef.current.set(avatar._id, buildSimState(avatar));
        } else {
          const existing = statesRef.current.get(avatar._id)!;
          existing.alias = avatar.aliasSnapshot;
          existing.imageUrl = avatar.imageUrl ?? existing.imageUrl;
        }
      });

    console.log(`[NightclubScene] Active avatars after filter: ${activeIds.size}`);

    for (const key of Array.from(statesRef.current.keys())) {
      if (!activeIds.has(key)) {
        statesRef.current.delete(key);
      }
    }

    // Debounce state updates to reduce re-renders and improve performance
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      setSimStates(Array.from(statesRef.current.values()));
    }, 100);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [avatars]);

  const handleEncounter = useCallback<EncounterHandler>(
    (a, b) => {
      try {
        onEncounter(a, b);
      } catch (error) {
        console.error("NightclubScene encounter handler failed", error);
      }
    },
    [onEncounter]
  );

  return (
    <div className={clsx("relative overflow-hidden rounded-3xl border border-lime-400/40 bg-gradient-to-br from-black via-zinc-950 to-black", className)}>
      <Canvas
        flat
        orthographic
        camera={{ position: [0, 0, 50], zoom: 32 }}
        className="h-full w-full"
      >
        <color attach="background" args={["#040607"]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 5, 10]} intensity={1.2} color="#84ff00" />
        <Suspense fallback={null}>
          <Grid
            args={[FLOOR_SIZE, FLOOR_SIZE]}
            cellColor="#191919"
            sectionColor="#1f2937"
            sectionThickness={1.5}
            cellThickness={0.6}
            infiniteGrid={false}
            fadeStrength={0}
          />
          <SimulationLoop statesRef={statesRef} onEncounter={handleEncounter} />
          {simStates.map((state) => (
            <AvatarBubble
              key={state.id}
              state={state}
              isSelected={selectedId === state.id}
              onSelect={onSelect}
            />
          ))}
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
        Nightclub Floor
      </div>
    </div>
  );
};

export default NightclubScene;
