import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure lib logic. Node environment — the Expo/RN layer is not
// loaded, so only framework-free modules are covered here. Component tests
// would use jest-expo once a babel config is in place.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
