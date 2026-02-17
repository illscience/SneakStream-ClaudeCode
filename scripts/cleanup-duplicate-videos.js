#!/usr/bin/env node
/**
 * Cleanup duplicate / short video records in Convex.
 *
 * Runs a Convex internal mutation via `npx convex run`.
 *
 * Modes:
 *   PREVIEW  (default) — shows what would be deleted without changing any data
 *   EXECUTE            — actually deletes the records
 *
 * Operations:
 *   --duplicates       — remove duplicate videos sharing the same assetId
 *                        (keeps the one with the longer duration)
 *   --short [minutes]  — remove videos shorter than N minutes (default 5)
 *   --both             — run both operations
 *
 * Usage:
 *   node scripts/cleanup-duplicate-videos.js --duplicates
 *   node scripts/cleanup-duplicate-videos.js --short 5
 *   node scripts/cleanup-duplicate-videos.js --both
 *   node scripts/cleanup-duplicate-videos.js --duplicates --execute
 *
 * To run against production, set CONVEX_DEPLOY_KEY:
 *   CONVEX_DEPLOY_KEY='prod:...' node scripts/cleanup-duplicate-videos.js --duplicates
 */

const { execSync } = require("child_process");

const cliArgs = process.argv.slice(2);

const EXECUTE = cliArgs.includes("--execute");
const RUN_DUPLICATES = cliArgs.includes("--duplicates") || cliArgs.includes("--both");
const RUN_SHORT = cliArgs.includes("--short") || cliArgs.includes("--both");

let shortMinutes = 5;
const shortIdx = cliArgs.indexOf("--short");
if (shortIdx !== -1 && cliArgs[shortIdx + 1] && !cliArgs[shortIdx + 1].startsWith("--")) {
  shortMinutes = parseFloat(cliArgs[shortIdx + 1]);
  if (isNaN(shortMinutes) || shortMinutes <= 0) {
    console.error("Error: --short requires a positive number of minutes.");
    process.exit(1);
  }
}

if (!RUN_DUPLICATES && !RUN_SHORT) {
  console.log(`
Usage: node scripts/cleanup-duplicate-videos.js [options]

Options:
  --duplicates       Remove duplicate videos with same assetId (keep longer one)
  --short [minutes]  Remove videos shorter than N minutes (default 5)
  --both             Run both operations
  --execute          Actually delete records (default is PREVIEW mode)

Examples:
  node scripts/cleanup-duplicate-videos.js --duplicates
  node scripts/cleanup-duplicate-videos.js --short 3
  node scripts/cleanup-duplicate-videos.js --both --execute
`);
  process.exit(1);
}

// Build the operation string
let operation = "duplicates";
if (RUN_DUPLICATES && RUN_SHORT) operation = "both";
else if (RUN_SHORT) operation = "short";

// Build the Convex function args as JSON
const fnArgs = {
  mode: EXECUTE ? "execute" : "preview",
  operation,
  shortThresholdMinutes: shortMinutes,
};

const argsJson = JSON.stringify(JSON.stringify(fnArgs));

// Build the npx convex run command
const cmd = `npx convex run cleanupVideos:cleanup ${argsJson}`;

console.log(`Running: ${cmd}\n`);

try {
  execSync(cmd, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}
