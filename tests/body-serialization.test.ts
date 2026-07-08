import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";

describe("body serialization", () => {
  const mkApi = () => {
    const seen: RequestInit[] = [];
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        seen.push(init ?? {});
        return Response.json({});
      },
    });
    return { seen, api };
  };

  test("default JSON body serialization", async () => {
    const { seen, api } = mkApi();
    await api.endpoint("/posts").body(z.object({ title: z.string() }))({ body: { title: "hello" } });

    expect(seen[0]?.body).toBe(JSON.stringify({ title: "hello" }));
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
  });

  test("explicit json kind produces correct body and Content-Type", async () => {
    const { seen, api } = mkApi();
    await api.endpoint("/posts").body(z.object({ title: z.string() }), { kind: "json" })({ body: { title: "hello" } });

    expect(seen[0]?.body).toBe(JSON.stringify({ title: "hello" }));
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
  });

  test("form-data kind passes through and does not set Content-Type", async () => {
    const { seen, api } = mkApi();

    const fd = new FormData();
    fd.append("key", "value");
    await api.endpoint("/posts").body(z.instanceof(FormData), { kind: "form-data" })({ body: fd });

    expect(seen[0]?.body).toBe(fd);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBeUndefined();
  });

  test("url-encoded kind passes through and sets correct Content-Type", async () => {
    const { seen, api } = mkApi();

    const params = new URLSearchParams({ name: "test" });
    await api.endpoint("/posts").body(z.instanceof(URLSearchParams), { kind: "url-encoded" })({ body: params });

    expect(seen[0]?.body).toBe(params);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  test("text kind stringifies body and sets text/plain", async () => {
    const { seen, api } = mkApi();
    await api.endpoint("/posts").body(z.string(), { kind: "text" })({ body: "raw text" });

    expect(seen[0]?.body).toBe("raw text");
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("text/plain");
  });

  test("binary kind passes through and sets octet-stream", async () => {
    const { seen, api } = mkApi();
    const blob = new Blob(["binary data"]);
    await api.endpoint("/posts").body(z.instanceof(Blob), { kind: "binary" })({ body: blob });

    expect(seen[0]?.body).toBe(blob);
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/octet-stream");
  });

  test("custom serializer with custom Content-Type", async () => {
    const { seen, api } = mkApi();
    await api.endpoint("/posts").body(z.string(), {
      kind: "text",
      contentType: "text/markdown",
    })({ body: "# hello" });

    expect(seen[0]?.body).toBe("# hello");
    expect((seen[0]?.headers as Record<string, string>)?.["Content-Type"]).toBe("text/markdown");
  });

  test("custom serialize function with custom Content-Type", async () => {
    const { seen, api } = mkApi();
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
