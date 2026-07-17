import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";

describe("TypedResponse proxy", () => {
  test("accesses brand-checked properties with the underlying Response as receiver", async () => {
    const response = Response.json({ ok: true });

    Object.defineProperty(response, "formatJsgResourceType", {
      get() {
        if (this !== response) {
          throw new TypeError("Illegal invocation");
        }
        return "Response";
      }
    });

    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => response,
    });

    const result = await api.endpoint("/data").output(z.unknown()).result();
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(
      (result.value as typeof result.value & { formatJsgResourceType: string })
        .formatJsgResourceType
    ).toBe("Response");
  });
});
