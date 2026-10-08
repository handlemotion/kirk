import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        test: {
          name: "shared",
          include: ["packages/shared/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
      {
        test: {
          name: "desktop",
          include: ["apps/desktop/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
});
