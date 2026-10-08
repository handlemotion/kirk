// Serves the real desktop UI with Vite, pointed at the local backend.
import { createServer } from "vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "desktop",
);

export async function startApp(convexUrl: string, port: number) {
  // A shell variable beats any .env.local in apps/desktop.
  process.env.VITE_CONVEX_URL = convexUrl;
  const server = await createServer({
    root: desktop,
    logLevel: "warn",
    server: { port, strictPort: true, forwardConsole: false },
  });
  await server.listen();
  return { stop: () => server.close() };
}
