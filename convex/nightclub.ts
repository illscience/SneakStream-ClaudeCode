import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const ACTIVE_ENCOUNTER_COOLDOWN_MS = 30_000;

const buildPairKey = (a: Id<"nightclubAvatars">, b: Id<"nightclubAvatars">) => {
  const [first, second] = a < b ? [a, b] : [b, a];
  return `${first}:${second}`;
};

export const spawnAvatar = mutation({
  args: {
    clerkId: v.string(),
    aliasSnapshot: v.string(),
    seed: v.number(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const avatarId = await ctx.db.insert("nightclubAvatars", {
      clerkId: args.clerkId,
      aliasSnapshot: args.aliasSnapshot,
      seed: args.seed,
      prompt: args.prompt,
      imageUrl: undefined,
      spawnedAt: Date.now(),
      isActive: true,
      lastConversationAt: undefined,
    });

    return avatarId;
  },
});

export const setAvatarImage = mutation({
  args: {
    avatarId: v.id("nightclubAvatars"),
    imageUrl: v.string(),
  },
  handler: async (ctx, { avatarId, imageUrl }) => {
    await ctx.db.patch(avatarId, {
      imageUrl,
    });
  },
});

export const deactivateAvatar = mutation({
  args: {
    avatarId: v.id("nightclubAvatars"),
  },
  handler: async (ctx, { avatarId }) => {
    await ctx.db.patch(avatarId, {
      isActive: false,
    });
  },
});

export const touchAvatarConversation = mutation({
  args: {
    avatarId: v.id("nightclubAvatars"),
  },
  handler: async (ctx, { avatarId }) => {
    await ctx.db.patch(avatarId, {
      lastConversationAt: Date.now(),
    });
  },
});

export const getActiveAvatars = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("nightclubAvatars")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(100);
  },
});

export const getAvatarsByIds = query({
  args: {
    avatarIds: v.array(v.id("nightclubAvatars")),
  },
  handler: async (ctx, { avatarIds }) => {
    const avatars = await Promise.all(
      avatarIds.map((avatarId) => ctx.db.get(avatarId))
    );

    return avatars.filter((avatar): avatar is NonNullable<typeof avatar> => Boolean(avatar));
  },
});

export const beginEncounter = mutation({
  args: {
    avatarA: v.id("nightclubAvatars"),
    avatarB: v.id("nightclubAvatars"),
  },
  handler: async (ctx, { avatarA, avatarB }) => {
    if (avatarA === avatarB) {
      return { shouldGenerate: false, encounterId: null } as const;
    }

    const pairKey = buildPairKey(avatarA, avatarB);
    const now = Date.now();

    const recentEncounter = await ctx.db
      .query("nightclubEncounters")
      .withIndex("by_pair", (q) => q.eq("pairKey", pairKey))
      .order("desc")
      .first();

    if (
      recentEncounter &&
      now - recentEncounter.startedAt < ACTIVE_ENCOUNTER_COOLDOWN_MS &&
      recentEncounter.status !== "failed"
    ) {
      return { shouldGenerate: false, encounterId: recentEncounter._id } as const;
    }

    const encounterId = await ctx.db.insert("nightclubEncounters", {
      avatarA,
      avatarB,
      pairKey,
      startedAt: now,
      transcript: undefined,
      summary: undefined,
      status: "pending",
    });

    return { shouldGenerate: true, encounterId } as const;
  },
});

export const finalizeEncounter = mutation({
  args: {
    encounterId: v.id("nightclubEncounters"),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, { encounterId, transcript, summary, status }) => {
    await ctx.db.patch(encounterId, {
      transcript,
      summary,
      status,
    });
  },
});

export const getRecentEncounters = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const take = limit ?? 20;
    return await ctx.db
      .query("nightclubEncounters")
      .withIndex("by_recent")
      .order("desc")
      .take(take);
  },
});
