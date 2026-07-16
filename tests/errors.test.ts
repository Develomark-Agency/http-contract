import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import {
  HttpContractAbortError,
  HttpContractFetchError,
  HttpContractJsonParseError,
  requestContextKey,
} from "../src/errors";

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

  test("schema error carries request context on request-level validation", async () => {
    const api = defineApi({ baseUrl: "https://example.com" });

    const result = await api.endpoint("/posts/{postId}")
      .path(z.object({ postId: z.number() }))
      .result({ path: { postId: "abc" as any } });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const ctx = (result.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toBe("/posts/{postId}");
    }
  });

  test("schema error carries request context on body validation", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ name: 123 }),
    });

    const response = await api.endpoint("/posts")
      .output(z.object({ name: z.string() }))
      .result();

    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const body = await response.value.json();
    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      const ctx = (body.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toContain("example.com/posts");
    }
  });

  test("fetch error carries request context", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => { throw new Error("network down"); }
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const ctx = (result.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toContain("example.com/posts");
    }
  });

  test("abort error carries request context", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => { throw new DOMException("aborted", "AbortError"); }
    });

    const result = await api.endpoint("/posts").result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const ctx = (result.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toContain("example.com/posts");
    }
  });

  test("JSON parse error carries request context", async () => {
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
      const ctx = (body.error as any)[requestContextKey];
      expect(ctx).toBeDefined();
      expect(ctx.method).toBe("GET");
      expect(ctx.url).toContain("example.com/posts");
    }
  });
});
