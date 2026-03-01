const DEFAULT_CLERK_ISSUER_DOMAIN = "https://clerk.sneakstream.xyz";

const normalizeIssuerDomain = (value: string | undefined) => {
  const resolved = (value ?? DEFAULT_CLERK_ISSUER_DOMAIN).trim();
  return resolved.replace(/\/+$/, "");
};

export default {
  providers: [
    {
      // If this value doesn't exactly match JWT `iss`, ctx.auth.getUserIdentity() is null.
      domain: normalizeIssuerDomain(process.env.CLERK_JWT_ISSUER_DOMAIN),
      applicationID: "convex",
    },
  ],
};
