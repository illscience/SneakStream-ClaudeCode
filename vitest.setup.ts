import { afterEach, beforeEach, vi } from "vitest";
import { config } from "dotenv";

config({ path: ".env", override: false });
config({ path: ".env.local", override: false });

beforeEach(() => {
  if (!process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN) {
    process.env.MUX_TOKEN_ID = process.env.MUX_TOKEN;
  }
  if (!process.env.MUX_TOKEN_SECRET && process.env.MUX_SECRET_KEY) {
    process.env.MUX_TOKEN_SECRET = process.env.MUX_SECRET_KEY;
  }

  process.env.MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || "test-token-id";
  process.env.MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || "test-token-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});
