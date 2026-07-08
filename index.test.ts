import { describe, expect, test } from "bun:test";
import z from "zod";
import {
  defineApi,
  HttpContractAbortError,
  HttpContractFetchError,
  HttpContractJsonParseError
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
