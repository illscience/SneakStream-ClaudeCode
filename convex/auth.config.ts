export default {
  providers: [
    {
      // The domain from which Clerk tokens are issued.
      // Get this from Clerk Dashboard > API Keys > "Issuer" or construct from your Clerk frontend API:
      // e.g., "https://your-app.clerk.accounts.dev" or "https://clerk.your-domain.com"
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      // Application ID - set to "convex" to match the default Clerk JWT template
      applicationID: "convex",
    },
  ],
};
