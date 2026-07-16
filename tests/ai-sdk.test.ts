import { describe, expect, test } from "bun:test";
import { asSchema } from "ai";
import z from "zod";
import { defineApi } from "../index";
import { toAiTool } from "../ai-sdk";

describe("toAiTool", () => {
  test("exposes endpoint inputs as an AI SDK schema", async () => {
    const endpoint = defineApi({ baseUrl: "https://example.com" })
      .endpoint("/users/{id}")
      .path(z.object({ id: z.number() }))
      .query(z.object({ verbose: z.boolean().optional() }));

    const aiTool = toAiTool(endpoint, { description: "Get a user" });
    const schema = await asSchema(aiTool.inputSchema).jsonSchema;

    expect(aiTool.description).toBe("Get a user");
    expect(schema).toMatchObject({
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "object" },
        query: { type: "object" },
      },
    });
  });

  test("executes the request, reads JSON, and forwards the abort signal", async () => {
    let request: RequestInit | undefined;
    const endpoint = defineApi({
      baseUrl: "https://example.com",
      fetch: async (_input, init) => {
        request = init;
        return Response.json({ id: 7, name: "Ada" });
      },
    }).endpoint("/users/{id}")
      .path(z.object({ id: z.number() }))
      .output(z.object({ id: z.number(), name: z.string() }));
    const aiTool = toAiTool(endpoint);
    const controller = new AbortController();

    const output = await aiTool.execute!({ path: { id: 7 } }, {
      abortSignal: controller.signal,
      context: {},
      messages: [],
      toolCallId: "call-1",
    });

    expect(output).toEqual({ id: 7, name: "Ada" });
    expect(request?.signal).toBe(controller.signal);
  });

  test("creates a schema for unrefined template path parameters", async () => {
    const endpoint = defineApi({ baseUrl: "https://example.com" }).endpoint("/posts/{postId}");
    const schema = await asSchema(toAiTool(endpoint).inputSchema).jsonSchema;

    expect(schema).toMatchObject({
      required: ["path"],
      properties: { path: { required: ["postId"] } },
    });
  });
});
