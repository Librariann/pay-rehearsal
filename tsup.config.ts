import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  injectStyle: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
