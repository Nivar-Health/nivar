// Global setup for `node --test`: makes sure a Next.js dev server answers on the test port,
// seeds the Supabase project before the suite and reseeds it afterwards so the demo data is clean.
// Used through `--test-global-setup=test/server.ts`; also exposes start/stop for ad hoc use.
//
// Next 16 allows a single `next dev` per project directory. When `pnpm dev` is already running
// (default port 3100) the test server cannot start, so the suite reuses that instance instead and
// hands its URL to the test processes through TEST_BASE_URL (children inherit this process's env).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { REPO_DIR, TEST_PORT, WEB_DIR } from "./env.ts";

const DEV_PORT = 3100;
const START_TIMEOUT_MS = 120_000;

let child: ChildProcess | null = null;

const baseUrl = () => process.env.TEST_BASE_URL || `http://localhost:${TEST_PORT}`;

async function isHealthy(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves true when healthy, false when the child exited before answering; throws on timeout. */
async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(url)) return true;
    if (child && child.exitCode !== null) return false;
    await sleep(500);
  }
  throw new Error(`Dev server did not answer on ${url}/api/health within ${timeoutMs / 1000}s`);
}

/** Start `next dev -p <port>` unless something already answers on /api/health. Returns the URL to test against. */
export async function startServer(): Promise<{ started: boolean; url: string }> {
  if (await isHealthy(baseUrl())) return { started: false, url: baseUrl() };
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  // Own process group so the whole next dev tree (it forks a server worker) can be stopped at once.
  child = spawn(process.execPath, [nextBin, "dev", "-p", String(TEST_PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, PORT: String(TEST_PORT), NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });
  child.unref();
  if (await waitForHealth(baseUrl(), START_TIMEOUT_MS)) return { started: true, url: baseUrl() };

  // next dev exited: most likely another dev server holds the project lock. Reuse it if it is healthy.
  const code = child.exitCode;
  child = null;
  const devUrl = `http://localhost:${DEV_PORT}`;
  if (await isHealthy(devUrl)) {
    process.env.TEST_BASE_URL = devUrl;
    return { started: false, url: devUrl };
  }
  throw new Error(`next dev -p ${TEST_PORT} exited with code ${code} and nothing answers on ${devUrl}`);
}

/** Stop the dev server if this process started it. */
export async function stopServer(): Promise<void> {
  const proc = child;
  child = null;
  if (!proc || proc.exitCode !== null || !proc.pid) return;
  const exited = new Promise<void>((resolve) => proc.once("exit", () => resolve()));
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill("SIGTERM");
  }
  await Promise.race([exited, sleep(10_000)]);
  if (proc.exitCode === null) {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      proc.kill("SIGKILL");
    }
  }
}

/** Run `pnpm --filter web seed` synchronously with inherited stdio; throws on a non-zero exit. */
export function runSeed(label: string): void {
  console.log(`[test] seeding (${label})...`);
  const res = spawnSync("pnpm", ["--filter", "web", "seed"], { cwd: REPO_DIR, stdio: "inherit", env: process.env });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`seed failed with exit code ${res.status}`);
}

export async function globalSetup(): Promise<void> {
  const { started, url } = await startServer();
  console.log(`[test] dev server ${started ? "started" : "already running"} at ${url}`);
  runSeed("before suite");
}

export async function globalTeardown(): Promise<void> {
  try {
    runSeed("after suite");
  } finally {
    await stopServer();
  }
}
