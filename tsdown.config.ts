import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "index.ts",
    hono: "hono.ts"
  }
});
