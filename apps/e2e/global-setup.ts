import { startApp } from "./support/app";
import { startBackend } from "./support/backend";

import { PORT } from "./support/port";

// Runs once. The returned function is the teardown.
export default async function globalSetup() {
  const backend = await startBackend();
  let app: Awaited<ReturnType<typeof startApp>>;
  try {
    app = await startApp(backend.url, PORT);
  } catch (error) {
    await backend.stop();
    throw error;
  }
  return async () => {
    await app.stop();
    await backend.stop();
  };
}
