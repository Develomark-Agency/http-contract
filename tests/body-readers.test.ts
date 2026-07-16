import { describe, expect, test } from "bun:test";
import z from "zod";
import { defineApi } from "../index";
import { HttpContractSchemaError } from "../src/errors";

describe("body reader modes", () => {
  test("reads response as json", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => Response.json({ value: 42 }),
    });

    const response = await api.endpoint("/data").output(z.object({ value: z.number() })).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const bodyResult = await response.value.json();
    expect(bodyResult.isOk()).toBe(true);
    if (bodyResult.isOk()) {
      expect(bodyResult.value).toEqual({ value: 42 });
    }
  });

  test("reads response as text", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response("plain text response"),
    });

    const response = await api.endpoint("/doc").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const bodyResult = await response.value.text();
    expect(bodyResult.isOk()).toBe(true);
    if (bodyResult.isOk()) {
      expect(bodyResult.value).toBe("plain text response");
    }
  });

  test("reads response as blob", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response(new Blob(["blob data"])),
    });

    const response = await api.endpoint("/doc").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const blobResult = await response.value.blob();
    expect(blobResult.isOk()).toBe(true);
    if (blobResult.isOk()) {
      const blob = blobResult.value as Blob;
      const text = await blob.text();
      expect(text).toBe("blob data");
    }
  });

  test("reads response as arrayBuffer", async () => {
    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response(new TextEncoder().encode("abc").buffer),
    });

    const response = await api.endpoint("/doc").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const bufResult = await response.value.arrayBuffer();
    expect(bufResult.isOk()).toBe(true);
    if (bufResult.isOk()) {
      expect(new Uint8Array(bufResult.value as ArrayBuffer)).toEqual(new Uint8Array([97, 98, 99]));
    }
  });

  test("reads response as formData", async () => {
    const form = new FormData();
    form.append("field", "value");

    const api = defineApi({
      baseUrl: "https://example.com",
      fetch: async () => new Response(form),
    });

    const response = await api.endpoint("/doc").output(z.unknown()).result();
    expect(response.isOk()).toBe(true);
    if (response.isErr()) return;

    const fdResult = await response.value.formData();
    expect(fdResult.isOk()).toBe(true);
    if (fdResult.isOk()) {
      const fd = fdResult.value as FormData;
      expect(fd.get("field")).toBe("value");
    }
  });

  test("output schema validates and rejects invalid response body", async () => {
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
      expect(body.error).toBeInstanceOf(HttpContractSchemaError);
    }
  });
});
