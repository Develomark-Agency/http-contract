import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";

describe("clone()", () => {
  test("cloned TypedResponse can read body independently", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ value: 42 }),
    });

    const response = await api.endpoint("/data").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const cloned = response.value.clone();
    const originalBodyResult = await response.value.text();
    const clonedBodyResult = await cloned.text();

    expect(originalBodyResult.isOk()).toBe(true);
    expect(clonedBodyResult.isOk()).toBe(true);
    if (originalBodyResult.isOk() && clonedBodyResult.isOk()) {
      expect(originalBodyResult.value).toBe(clonedBodyResult.value);
    }
  });

  test("clone still works after original body is consumed", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ value: 42 }),
    });

    const response = await api.endpoint("/data").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const originalBodyResult = await response.value.text();
    expect(originalBodyResult.isOk()).toBe(true);

    const cloned = response.value.clone();
    const clonedBodyResult = await cloned.text();
    expect(clonedBodyResult.isOk()).toBe(true);
    if (clonedBodyResult.isOk()) {
      expect(clonedBodyResult.value).toBe(JSON.stringify({ value: 42 }));
    }
  });
});
