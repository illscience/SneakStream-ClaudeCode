import { query } from "./_generated/server";

const DEFAULT_CLERK_ISSUER_DOMAIN = "https://clerk.sneakstream.xyz";

const normalizeIssuerDomain = (value: string | undefined) => {
  const resolved = (value ?? DEFAULT_CLERK_ISSUER_DOMAIN).trim();
  return resolved.replace(/\/+$/, "");
};

export const getAuthStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    return {
      hasIdentity: identity !== null,
      subject: identity?.subject ?? null,
      issuer: identity?.issuer ?? null,
      tokenIdentifier: identity?.tokenIdentifier ?? null,
      configuredIssuerDomain: normalizeIssuerDomain(
        process.env.CLERK_JWT_ISSUER_DOMAIN,
      ),
      now: Date.now(),
    };
  },
});
