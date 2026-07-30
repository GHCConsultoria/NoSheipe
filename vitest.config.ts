import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Os specs de e2e/ são do Playwright, não do vitest — o glob padrão do
    // vitest pega *.spec.ts, então sem isto ele tentaria rodá-los e quebrar
    // no import de @playwright/test.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
