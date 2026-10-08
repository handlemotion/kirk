import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "convex/**/*.ts",
        "packages/shared/src/**/*.{ts,tsx}",
        "apps/desktop/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "convex/_generated/**",
        "packages/shared/src/fake-server.ts",
      ],
      reporter: ["text", "json-summary"],
      // Just below the values at the time of writing. Raise them as tests land.
      thresholds: {
        "convex/**": {
          statements: 93,
          branches: 95,
          functions: 99,
          lines: 93,
        },
        "packages/shared/**": {
          statements: 99,
          branches: 99,
          functions: 99,
          lines: 99,
        },
        "apps/desktop/**": {
          statements: 67,
          branches: 74,
          functions: 66,
          lines: 67,
        },
      },
    },
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
