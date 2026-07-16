import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import z from "zod";
import { defineApi } from "../index";
import { requestContextKey } from "../src/errors";

describe(".validate()", () => {
  test("validate can abort with Result.err on non-2xx status", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("not found", { status: 404 }),
    });

    const result = await api.endpoint("/posts")
      .validate((ctx) => {
        if (ctx.res.status === 404) return Result.err(new Error("resource not found"));
      }).result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect((result.error as Error).message).toBe("resource not found");
    }
  });

  test("validate allows passing through when returning void", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ id: 1 }),
    });

    const result = await api.endpoint("/posts")
      .validate(() => {}).result();

    expect(result.isOk()).toBe(true);
  });

  test("validate receives path, query, headers, method, and url context", async () => {
    const ctxSeen: unknown[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({}),
    });

    await api.endpoint("/posts/{id}")
      .path(z.object({ id: z.string() }))
      .query(z.object({ filter: z.string() }))
      .requestHeaders(z.object({ "x-trace": z.string() }))
      .validate((ctx) => { ctxSeen.push(ctx); })
      .result({ path: { id: "42" }, query: { filter: "all" }, headers: { "x-trace": "abc" } });

    expect(ctxSeen).toHaveLength(1);
    const ctx = ctxSeen[0] as Record<string, unknown>;
    expect(ctx).toHaveProperty("path");
    expect(ctx).toHaveProperty("query");
    expect(ctx).toHaveProperty("headers");
    expect(ctx).toHaveProperty("res");
    expect(ctx).toHaveProperty("method");
    expect(ctx).toHaveProperty("url");
  });
});

describe(".transform()", () => {
  test("transform replaces the output value", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ name: "Alice", age: 30 }),
    });

    const result = await api.endpoint("/users")
      .output(z.object({ name: z.string(), age: z.number() }))
      .transform((ctx) => ({ greeting: `Hello, ${ctx.value.name}`, years: ctx.value.age }))
      .result();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const value = await result.value.json();
      expect(value.isOk()).toBe(true);
      if (value.isOk()) {
        expect(value.value).toEqual({ greeting: "Hello, Alice", years: 30 });
      }
    }
  });

  test("transform can abort with Result.err", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ role: "guest" }),
    });

    const res = await api.endpoint("/users")
      .output(z.object({ role: z.string() }))
      .transform((ctx) => {
        if (ctx.value.role === "guest") return Result.err(new Error("guests not allowed"));
      }).result();

    expect(res.isOk()).toBe(true);
    if (!res.isOk()) throw res.error;
    const bodyResult = await (res.value as any).json();
    expect(bodyResult.isErr()).toBe(true);
    expect(bodyResult.error.message).toBe("guests not allowed");
  });

  test("transform error carries request context", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ role: "guest" }),
    });

    const res = await api.endpoint("/users")
      .output(z.object({ role: z.string() }))
      .transform((ctx) => {
        if (ctx.value.role === "guest") return Result.err(new Error("guests not allowed"));
      }).result();

    expect(res.isOk()).toBe(true);
    if (!res.isOk()) throw res.error;
    const bodyResult = await (res.value as any).json();
    expect(bodyResult.isErr()).toBe(true);
    const ctx = (bodyResult.error as any)[requestContextKey];
    expect(ctx).toBeDefined();
    expect(ctx.method).toBe("GET");
    expect(ctx.url).toContain("example.com/users");
  });
});
