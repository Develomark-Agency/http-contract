import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import z from "zod";
import {
  defineApi,
  HttpContractAbortError,
  HttpContractFetchError,
  HttpContractJsonParseError,
  HttpContractSchemaError
} from "./index";

describe("default errors", () => {
  test("wraps fetch failures", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => {
        throw new Error("network down");
      }
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractFetchError);
    }
  });

  test("wraps abort failures", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => {
        throw new DOMException("aborted", "AbortError");
      }
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractAbortError);
    }
  });

  test("wraps invalid JSON body parsing", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("not json")
    });

    const response = await api.endpoint("/posts").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const body = await response.value.json();

    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      expect(body.error).toBeInstanceOf(HttpContractJsonParseError);
    }
  });
});

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
});

describe("optional query args", () => {
  test("allows omitting args when query fields are optional", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json([]);
      }
    });

    const endpoint = api.endpoint("/posts")
      .query(z.object({ id: z.number().optional() }))
      .output(z.array(z.unknown()));

    await endpoint();
    await endpoint({});
    await endpoint({ query: {} });
    await endpoint({ query: { id: 1 } });

    expect(urls).toEqual([
      "https://example.com/posts",
      "https://example.com/posts",
      "https://example.com/posts",
      "https://example.com/posts?id=1"
    ]);
  });
});

describe("request options", () => {
  test("passes fetch request options through at the callsite", async () => {
    const seen: RequestInit[] = [];
    const signal = new AbortController().signal;
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      }
    });

    await api.endpoint("/posts")({
      method: "post",
      cache: "no-store",
      credentials: "omit",
      signal
    });

    expect(seen[0]).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      signal
    });
  });

  test("endpoint method takes precedence over callsite method", async () => {
    const methods: Array<string | undefined> = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        methods.push(init?.method);
        return Response.json({});
      }
    });

    await (api.endpoint("/posts").method("put") as any)({ method: "post" });

    expect(methods).toEqual(["PUT"]);
  });
});

describe("headers", () => {
  test("serializes schema-validated request headers", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      }
    });

    const endpoint = api.endpoint("/posts")
      .requestHeaders(z.object({
        "X-Custom-Header": z.number(),
        "X-List": z.array(z.number()).optional()
      }));

    await endpoint({ headers: { "X-Custom-Header": 123, "X-List": [1, 2] } });

    expect(seen[0]?.headers).toEqual({
      "X-Custom-Header": "123",
      "X-List": "1, 2"
    });
  });

  test("validates response headers", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("{}", {
        headers: { "content-type": "application/json" }
      })
    });

    const result = await api.endpoint("/posts")
      .responseHeaders(z.object({ "x-required": z.string() }))
      .result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(HttpContractSchemaError);
    }
  });
});

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
});

describe("body serialization", () => {
  test("default JSON body serialization", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").body(z.object({ title: z.string() }))({ body: { title: "hello" } });

    expect(seen[0]?.body).toBe(JSON.stringify({ title: "hello" }));
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
  });

  test("explicit json kind produces correct body and Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").body(z.object({ title: z.string() }), { kind: "json" })({ body: { title: "hello" } });

    expect(seen[0]?.body).toBe(JSON.stringify({ title: "hello" }));
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
  });

  test("form-data kind passes through and does not set Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    const fd = new FormData();
    fd.append("key", "value");
    await api.endpoint("/posts").body(z.instanceof(FormData), { kind: "form-data" })({ body: fd });

    expect(seen[0]?.body).toBe(fd);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBeUndefined();
  });

  test("url-encoded kind passes through and sets correct Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    const params = new URLSearchParams({ name: "test" });
    await api.endpoint("/posts").body(z.instanceof(URLSearchParams), { kind: "url-encoded" })({ body: params });

    expect(seen[0]?.body).toBe(params);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  test("text kind stringifies body and sets text/plain", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").body(z.string(), { kind: "text" })({ body: "raw text" });

    expect(seen[0]?.body).toBe("raw text");
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("text/plain");
  });

  test("binary kind passes through and sets octet-stream", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    const blob = new Blob(["binary data"]);
    await api.endpoint("/posts").body(z.instanceof(Blob), { kind: "binary" })({ body: blob });

    expect(seen[0]?.body).toBe(blob);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/octet-stream");
  });

  test("custom serializer with custom Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").body(z.string(), {
      kind: "text",
      contentType: "text/markdown",
    })({ body: "# hello" });

    expect(seen[0]?.body).toBe("# hello");
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("text/markdown");
  });

  test("custom serialize function with custom Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });

    await api.endpoint("/posts").body(z.object({ name: z.string() }), {
      contentType: "application/xml",
      serialize: (v) => `<name>${(v as { name: string }).name}</name>`,
    })({ body: { name: "Alice" } });

    expect(seen[0]?.body).toBe("<name>Alice</name>");
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/xml");
  });

  test("user headers override body Content-Type", async () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    await api.endpoint("/posts").body(z.object({ x: z.number() }))({ body: { x: 1 } });

    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/vnd.api+json");
  });
});
