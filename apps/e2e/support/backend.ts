// Starts a throwaway local Convex backend. No account and no login.
//
// `convex dev` runs in anonymous agent mode. It downloads the open-source
// backend binary from GitHub on first use and keeps the data in
// `.backend/.convex`. The backend is a child of `convex dev`, so stopping
// `convex dev` stops it.
//
// `convex dev` runs in a scratch folder. That keeps its `.env.local` and
// state away from the repo root, where a developer may keep a real
// deployment URL.
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { spawn, type ChildProcess } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const scratch = join(here, "..", ".backend");
const convexBin = join(here, "..", "node_modules", ".bin", "convex");

const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };

export type Backend = { url: string; stop: () => Promise<void> };

// Same keys as scripts/generate-keys.mjs, in .env file form.
async function authKeys(): Promise<string> {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = (await exportPKCS8(keys.privateKey))
    .trimEnd()
    .replace(/\n/g, " ");
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  return `JWT_PRIVATE_KEY="${privateKey}"\nJWKS='${jwks}'\n`;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(convexBin, args, { cwd: scratch, env });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`convex ${args[0]}: ${output}`)),
    );
  });
}

export async function startBackend(): Promise<Backend> {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  symlinkSync(join(root, "convex"), join(scratch, "convex"));
  writeFileSync(join(scratch, "convex.json"), '{ "functions": "convex/" }\n');
  writeFileSync(
    join(scratch, "package.json"),
    '{ "type": "module", "dependencies": { "convex": "*" } }\n',
  );
  symlinkSync(join(here, "..", "node_modules"), join(scratch, "node_modules"));

  // Own process group, so one signal stops `convex dev` and the backend.
  const dev: ChildProcess = spawn(
    convexBin,
    [
      "dev",
      "--codegen",
      "disable",
      "--typecheck",
      "disable",
      "--tail-logs",
      "disable",
    ],
    { cwd: scratch, env, detached: true },
  );
  let log = "";
  const ready = new Promise<void>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      log += chunk;
      if (log.includes("Convex functions ready")) resolve();
    };
    dev.stdout!.on("data", onData);
    dev.stderr!.on("data", onData);
    dev.on("exit", () => reject(new Error(`convex dev exited:\n${log}`)));
  });

  const stop = () =>
    new Promise<void>((resolve) => {
      if (dev.exitCode !== null || dev.pid === undefined) return resolve();
      dev.on("exit", () => resolve());
      process.kill(-dev.pid, "SIGTERM");
      setTimeout(() => {
        if (dev.pid !== undefined) {
          try {
            process.kill(-dev.pid, "SIGKILL");
          } catch {}
        }
        resolve();
      }, 5000).unref();
    });

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`convex dev timed out:\n${log}`)),
        120_000,
      ).unref(),
    );
    await Promise.race([ready, timeout]);
    writeFileSync(join(scratch, "auth.env"), await authKeys());
    await run(["env", "set", "--from-file", "auth.env"]);
    const dotEnv = readFileSync(join(scratch, ".env.local"), "utf8");
    const url = /^[A-Z_]*CONVEX_URL=(.+)$/m.exec(dotEnv)?.[1];
    if (!url) throw new Error(`No Convex URL in .env.local:\n${dotEnv}`);
    return { url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
