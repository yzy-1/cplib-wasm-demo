import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        checker: resolve(__dirname, "checker.html"),
        interactor: resolve(__dirname, "interactor.html"),
        validator: resolve(__dirname, "validator.html"),
        generator: resolve(__dirname, "generator.html"),
      },
    },
    modulePreload: {
      polyfill: false,
    },
  },
});
