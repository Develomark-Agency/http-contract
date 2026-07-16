import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    neverBundle: ["ai"],
    dts: { neverBundle: ["ai"] }
  },
  entry: {
    index: "index.ts",
    hono: "hono.ts",
    "ai-sdk": "ai-sdk.ts"
  }
});
