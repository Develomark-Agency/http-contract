import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import { HttpContractSchemaError } from "../src/errors";

describe("endpoint config", () => {
  test("exposes configured schemas", () => {
    const api = defineApi({ baseUrl: "https://example.com" });
    const pathSchema = z.object({ id: z.number() });
    const querySchema = z.object({ page: z.number() });
    const requestHeadersSchema = z.object({ authorization: z.string() });
    const responseHeadersSchema = z.object({ "content-type": z.string() });
    const bodySchema = z.object({ title: z.string() });
    const outputSchema = z.object({ ok: z.boolean() });
    const validate = () => undefined;
    const transform = ({ value }: { value: { ok: boolean } }) => value.ok;
    const endpoint = api.endpoint("/posts/{id}")
      .path(pathSchema)
      .query(querySchema)
      .requestHeaders(requestHeadersSchema)
      .responseHeaders(responseHeadersSchema)
      .body(bodySchema)
      .output(outputSchema)
      .validate(validate)
      .transform(transform);

    expect(endpoint.config).toEqual({
      pathSchema,
      querySchema,
      requestHeadersSchema,
      responseHeadersSchema,
      bodySchema,
      outputSchema,
      validate,
      transform,
    });
  });
});

describe("path parameters", () => {
  test("interpolates multiple path parameters", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/users/{userId}/posts/{postId}")
      .path(z.object({ userId: z.number(), postId: z.number() }))
      .result({ path: { userId: 1, postId: 99 } });

    expect(urls[0]).toBe("https://example.com/users/1/posts/99");
  });

  test("encodes special characters in path params", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/search/{query}")
      .path(z.object({ query: z.string() }))
      .result({ path: { query: "hello world/foo" } });

    expect(urls[0]).toBe("https://example.com/search/hello%20world%2Ffoo");
  });

  test("boolean path param is stringified", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/items/{flag}")
      .path(z.object({ flag: z.boolean() }))
      .result({ path: { flag: true } });

    expect(urls[0]).toBe("https://example.com/items/true");
  });

  test("throws when path schema defined on template without params", () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    expect(() =>
      (api.endpoint("/posts") as any).path(z.object({ id: z.number() }))
    ).toThrow("Cannot define path schema for endpoint without path parameters: /posts");
  });
});

describe("query parameters", () => {
  test("sends array query params as repeated keys", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/posts")
      .query(z.object({ id: z.array(z.number()) }))
      .result({ query: { id: [1, 2, 3] } });

    expect(urls[0]).toBe("https://example.com/posts?id=1&id=2&id=3");
  });

  test("skips undefined query values", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/posts")
      .query(z.object({ a: z.string().optional(), b: z.string() }))
      .result({ query: { b: "keep" } });

    expect(urls[0]).toBe("https://example.com/posts?b=keep");
  });

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

  test("accepts query schema input and serializes transformed output", async () => {
    const urls: string[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async input => {
        urls.push(String(input));
        return Response.json({});
      },
    });

    await api.endpoint("/posts")
      .query(z.object({ something: z.string() }).transform(value => ({ s: value.something })))
      .result({ query: { something: "hello" } });

    expect(urls[0]).toBe("https://example.com/posts?s=hello");
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

  test("validates response headers successfully when they match", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("{}", {
        headers: { "x-trace-id": "abc-123" }
      })
    });

    const result = await api.endpoint("/posts")
      .responseHeaders(z.object({ "x-trace-id": z.string() }))
      .result();

    expect(result.isOk()).toBe(true);
  });
});
