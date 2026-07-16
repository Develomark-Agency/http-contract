import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import { HttpContractSchemaError } from "../src/errors";

describe(".url methods", () => {
  test("result.url returns the constructed URL as a Result", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const endpoint = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }));

    const result = await endpoint.result.url({ path: { postId: 5 } });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.href).toBe("https://example.com/posts/5");
    }
  });

  test("result.url returns schema errors as a Result", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const endpoint = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }));

    const result = await endpoint.result.url({ path: { postId: "not-a-number" as any } });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractSchemaError);
    }
  });

  test("result.url includes base API query params", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      query: { apiKey: "secret" }
    });

    const result = await api.endpoint("/posts").result.url({});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.href).toBe("https://example.com/posts?apiKey=secret");
    }
  });

  test("op.url returns a ProdkitOp and resolves on success", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const op = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }))
      .op.url({ path: { postId: 5 } });

    const result = await op.run();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.href).toBe("https://example.com/posts/5");
    }
  });

  test("op.url returns schema errors as a Result", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const op = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }))
      .op.url({ path: { postId: "abc" as any } });

    const result = await op.run();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractSchemaError);
    }
  });

  test("url() in throw mode constructs URL", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const endpoint = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }));

    const url = await endpoint.url({ path: { postId: 42 } });
    expect(url.href).toBe("https://example.com/posts/42");
  });

  test("url() in throw mode throws on schema error", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const endpoint = api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }));

    await expect(endpoint.url({ path: { postId: "bad" as any } })).rejects.toThrow(HttpContractSchemaError);
  });
});
