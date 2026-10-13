// Test environment: loads apps/web/.env.local (without overriding variables already set) and
// fails fast when the Supabase keys are missing. Import this before anything that talks to Supabase.
import { readFileSync } from "node:fs";
import path from "node:path";

export const WEB_DIR = path.resolve(import.meta.dirname, "..");
export const REPO_DIR = path.resolve(WEB_DIR, "..", "..");
export const ENV_FILE = path.join(WEB_DIR, ".env.local");

export const TEST_PORT = Number(process.env.TEST_PORT || 3199);
export const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${TEST_PORT}`;

/** Minimal dotenv parser: KEY=value lines, optional `export`, single or double quotes, # comments. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out[m[1]] = value;
  }
  return out;
}

function loadEnvFile(): void {
  let text: string;
  try {
    text = readFileSync(ENV_FILE, "utf8");
  } catch {
    return;
  }
  for (const [k, v] of Object.entries(parseEnv(text))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile();

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing ${missing.join(", ")}. Add them to ${ENV_FILE} before running the tests.`);
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
