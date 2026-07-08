import { describe, expect, test } from "bun:test";
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
