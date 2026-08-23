import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Los worktrees de agentes son copias completas del repositorio. Sin esto,
    // vitest corre las pruebas de otra rama como si fueran las de esta y el
    // veredicto deja de hablar del codigo que se va a mergear.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      ".claude/worktrees/**",
      ".worktrees/**",
    ],
  },
});
