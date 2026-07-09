import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "index.ts",
    errors: "errors.ts",
    types: "types.ts",
    hono: "hono.ts"
  }
});
