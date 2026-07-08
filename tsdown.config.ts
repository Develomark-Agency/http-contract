import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts", "errors.ts", "types.ts"],
  format: "esm",
  dts: true,
  clean: true
});
