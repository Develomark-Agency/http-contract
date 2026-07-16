import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import { HttpContractFetchError, HttpContractJsonParseError } from "../src/errors";

describe("throw mode", () => {
  test("direct call throws on fetch failure", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => { throw new Error("fail"); },
    });

    await expect(api.endpoint("/posts")()).rejects.toThrow(HttpContractFetchError);
  });

  test("direct call throws on schema error", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("not json"),
    });

    const response = await api.endpoint("/posts").output(z.unknown())();
    await expect(response.json()).rejects.toThrow(HttpContractJsonParseError);
  });
});

describe(".result() mode", () => {
  test("returns Ok on success", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ ok: true }),
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isOk()).toBe(true);
  });

  test("returns Err on fetch failure", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => { throw new Error("fail"); },
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isErr()).toBe(true);
  });
});

describe(".op() mode", () => {
  test("op returns a ProdkitOp and resolves on success", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ ok: true }),
    });

    const op = api.endpoint("/posts").output(z.object({ ok: z.boolean() })).op();

    const result = await op.run();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const value = await result.value.json().run();
      expect(value.isOk()).toBe(true);
      if (value.isOk()) {
        expect(value.value).toEqual({ ok: true });
      }
    }
  });

  test("op.run returns error on fetch failure", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => { throw new Error("network down"); },
    });

    const op = api.endpoint("/posts").op();
    const result = await op.run();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractFetchError);
    }
  });

  test("endpoint.op can be run directly with endpoint arguments", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (input) => Response.json({ url: String(input) }),
    });

    const endpoint = api.endpoint("/posts/{postId}").output(z.object({ url: z.string() }));
    const result = await endpoint.op.run({ path: { postId: 123 } });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const body = await result.value.json().run();
      expect(body.isOk()).toBe(true);
      if (body.isOk()) {
        expect(body.value).toEqual({ url: "https://example.com/posts/123" });
      }
    }
  });

  test("endpoint.op.url can be run directly with url arguments", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
    });

    const endpoint = api.endpoint("/posts/{postId}");
    const result = await endpoint.op.url.run({ path: { postId: 123 } });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toString()).toBe("https://example.com/posts/123");
    }
  });
});
