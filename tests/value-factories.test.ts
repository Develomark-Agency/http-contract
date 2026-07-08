import { describe, expect, test } from "bun:test";
import { defineApi } from "../index";
import { HttpContractRequestBuildError, requestContextKey } from "../errors";

describe("value factories", () => {
  test("async baseUrl function", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: async () => "https://api.example.com/v2",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/users").result();
    expect(urls[0]).toBe("https://api.example.com/v2/users");
  });

  test("function-based query values", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      query: { ts: () => "12345" },
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/posts").result();
    expect(urls[0]).toBe("https://example.com/posts?ts=12345");
  });

  test("function-based header values", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      headers: { Authorization: async () => "Bearer tok_xyz" },
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").result();
    expect((seen[0]?.headers as Record<string, string>)?.["Authorization"]).toBe("Bearer tok_xyz");
  });

  test("baseUrl factory throwing returns request build error", async () => {
    const api = defineApi({
      baseUrl: async () => { throw new Error("config error"); },
      fetch: async () => Response.json({}),
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractRequestBuildError);
    }
  });

  test("baseUrl factory throwing carries request context", async () => {
    const api = defineApi({
      baseUrl: async () => { throw new Error("config error"); },
      fetch: async () => Response.json({}),
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const ctx = (result.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toBe("/posts");
    }
  });

  test("header factory throwing returns request build error", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      headers: { Authorization: async () => { throw new Error("auth error"); } },
      fetch: async () => Response.json({}),
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractRequestBuildError);
    }
  });

  test("query factory throwing returns request build error", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      query: { page: async () => { throw new Error("bad query"); } },
      fetch: async () => Response.json({}),
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractRequestBuildError);
    }
  });
});
