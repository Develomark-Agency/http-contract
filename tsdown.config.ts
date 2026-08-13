import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: {
    index: "./index.ts",
    errors: "./errors.ts",
    internal: "./internal.ts"
  },
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist"
});
