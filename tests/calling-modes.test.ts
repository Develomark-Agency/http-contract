import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import { HttpContractFetchError, HttpContractJsonParseError } from "../errors";

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
});


