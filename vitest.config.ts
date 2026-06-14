import { defineConfig } from "vitest/config";

export default defineConfig({
  // Native tsconfig path resolution (@/ → src/), no extra plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Unit tests only. Integration gates that need a live DB / server are the
    // .mjs scripts (test:isolation, test:api), run separately.
    include: ["src/**/*.test.ts"],
  },
});
