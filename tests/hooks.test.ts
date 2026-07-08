import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { defineApi } from "../index";

describe("global interceptors", () => {
  test("onRequest can mutate init", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
      onRequest: [
        (ctx) => {
          ctx.init.headers = { ...(ctx.init.headers as Record<string, string>), "X-Injected": "yes" };
        },
      ],
    });

    await api.endpoint("/posts")({});

    expect((seen[0]?.headers as Record<string, string>)?.["X-Injected"]).toBe("yes");
  });

  test("onResponse can abort with Result.err", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("forbidden", { status: 403 }),
      onResponse: [
        (ctx) => {
          if (ctx.res.status === 403)
            return Result.err(new Error("access denied"));
        },
      ],
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe("access denied");
    }
  });

  test("onResponse does not abort when hook returns void", async () => {
    const seen: number[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ ok: true }),
      onResponse: [
        (ctx) => {
          seen.push(ctx.res.status);
        },
      ],
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isOk()).toBe(true);
    expect(seen).toEqual([200]);
  });

  test("onRequest and onResponse both run", async () => {
    const order: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        order.push("fetch");
        return Response.json({});
      },
      onRequest: [
        () => { order.push("onRequest"); },
      ],
      onResponse: [
        () => { order.push("onResponse"); },
      ],
    });

    await api.endpoint("/posts")({});

    expect(order).toEqual(["onRequest", "fetch", "onResponse"]);
  });

  test("onRequest can abort with Result.err before fetch", async () => {
    let fetchCalled = false;
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => {
        fetchCalled = true;
        return Response.json({});
      },
      onRequest: [
        () => Result.err(new Error("abort before fetch")),
      ],
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    expect(fetchCalled).toBe(false);
    if (result.isErr()) {
      expect((result.error as Error).message).toBe("abort before fetch");
    }
  });

  test("multiple onRequest hooks run in order", async () => {
    const order: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        order.push("fetch");
        return Response.json({});
      },
      onRequest: [
        () => { order.push("onRequest1"); },
        () => { order.push("onRequest2"); },
      ],
    });

    await api.endpoint("/posts")({});

    expect(order).toEqual(["onRequest1", "onRequest2", "fetch"]);
  });

  test("hook error carries request context", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("forbidden", { status: 403 }),
      onResponse: [
        (ctx) => {
          if (ctx.res.status === 403)
            return Result.err(new Error("access denied"));
        },
      ],
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const symbols = Object.getOwnPropertySymbols(result.error);
      expect(symbols.length).toBeGreaterThan(0);
    }
  });

  test("onRequest abort error carries request context", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({}),
      onRequest: [
        () => Result.err(new Error("abort")),
      ],
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const symbols = Object.getOwnPropertySymbols(result.error);
      expect(symbols.length).toBeGreaterThan(0);
    }
  });

  test("onRequest returning null continues (does not abort)", async () => {
    let fetchCalled = false;
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => {
        fetchCalled = true;
        return Response.json({ ok: true });
      },
      onRequest: [
        () => null as any,
      ],
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isOk()).toBe(true);
    expect(fetchCalled).toBe(true);
  });

  test("onResponse returning null continues", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ ok: true }),
      onResponse: [
        () => null as any,
      ],
    });

    const result = await api.endpoint("/posts").result();
    expect(result.isOk()).toBe(true);
  });
});
