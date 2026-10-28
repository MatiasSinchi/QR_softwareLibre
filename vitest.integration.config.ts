import { defineConfig } from "vitest/config";

// Pruebas de integración contra Supabase LOCAL (ver scripts/test-integration.sh).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
