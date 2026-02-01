import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check bidding session expiry every 5 seconds
crons.interval(
  "check bidding expiry",
  { seconds: 5 },
  internal.bidding.checkBiddingExpiry
);

// Auto-open bidding every 5 minutes for active streams
crons.interval(
  "auto open bidding",
  { minutes: 5 },
  internal.bidding.autoOpenBidding
);

export default crons;
