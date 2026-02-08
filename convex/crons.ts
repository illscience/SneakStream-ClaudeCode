import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check bidding session expiry every 5 seconds
crons.interval(
  "check bidding expiry",
  { seconds: 5 },
  internal.bidding.checkBiddingExpiry
);

export default crons;
