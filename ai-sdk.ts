import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import { asSchema, jsonSchema, tool } from "ai";
import { getEndpointState } from "./src/endpoint-state";

type EndpointArgs<E extends (...args: any[]) => any> = NonNullable<Parameters<E>[0]>;
type EndpointInput<E extends (...args: any[]) => any> = Pick<
  EndpointArgs<E>,
  Extract<keyof EndpointArgs<E>, "path" | "query" | "body" | "headers">
>;

type EndpointOutput<E extends (...args: any[]) => any> = Awaited<ReturnType<E>> extends { json(): infer Output }
  ? Awaited<Output>
  : never;
type ToolOutput<E extends (...args: any[]) => any> = [EndpointOutput<E>] extends [never] ? unknown : EndpointOutput<E>;

export type AiToolOptions = {
  description?: string;
  strict?: boolean;
  needsApproval?: boolean;
};

/** Turns an endpoint into an executable Vercel AI SDK tool. */
export function toAiTool<E extends (...args: any[]) => Promise<any>>(
  endpoint: E,
  options: AiToolOptions = {},
) {
  const state = getEndpointState(endpoint);
  const parts = getInputParts(state);
  const inputSchema = jsonSchema<EndpointInput<E>>(
    async () => {
      const resolved = await Promise.all(parts.map(async part => ({
        ...part,
        schema: await asSchema(part.schema).jsonSchema,
        required: await part.isRequired(),
      })));

      return {
        type: "object",
        properties: Object.fromEntries(resolved.map(part => [part.name, part.schema])),
        required: resolved.filter(part => part.required).map(part => part.name),
        additionalProperties: false,
      };
    },
    {
      validate: async value => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return { success: false, error: new TypeError("Tool input must be an object") };
        }

        const input = value as Record<string, unknown>;
        const output: Record<string, unknown> = {};
        for (const part of parts) {
          if (!(part.name in input)) {
            if (await part.isRequired()) return { success: false, error: new TypeError(`Missing required tool input: ${part.name}`) };
            continue;
          }
          const validated = await asSchema(part.schema).validate?.(input[part.name]);
          if (validated && !validated.success) return validated;
          output[part.name] = validated?.value ?? input[part.name];
        }
        return { success: true, value: output as EndpointInput<E> };
      },
    },
  );

  return tool<EndpointInput<E>, ToolOutput<E>, Record<string, unknown>>({
    ...options,
    inputSchema,
    execute: async (input: EndpointInput<E>, { abortSignal }) => {
      const response = await endpoint({ ...input, signal: abortSignal } as any);
      return response.json() as Promise<ToolOutput<E>>;
    },
  });
}

type InputPart = {
  name: "path" | "query" | "body" | "headers";
  schema: StandardSchema;
  isRequired: () => Promise<boolean>;
};

function getInputParts(state: ReturnType<typeof getEndpointState>): InputPart[] {
  const parts: InputPart[] = [];
  if (state.pathSchema) parts.push(inputPart("path", state.pathSchema));
  else {
    const names = [...state.template.matchAll(/\{([^}]+)\}/g)].map(match => match[1]!);
    if (names.length) parts.push(inputPart("path", pathSchema(names)));
  }
  if (state.querySchema) parts.push(inputPart("query", state.querySchema));
  if (state.bodySchema) parts.push(inputPart("body", state.bodySchema));
  if (state.requestHeadersSchema) parts.push(inputPart("headers", state.requestHeadersSchema));
  return parts;
}

function inputPart(name: InputPart["name"], schema: StandardSchema): InputPart {
  let required: Promise<boolean> | undefined;
  return {
    name,
    schema,
    isRequired: () => required ??= Promise.resolve(schema["~standard"].validate({}))
      .then(result => "issues" in result),
  };
}

function pathSchema(names: string[]): StandardSchema {
  return {
    "~standard": {
      version: 1,
      vendor: "http-contract",
      validate(value) {
        if (typeof value !== "object" || value === null || names.some(name => !(name in value))) {
          return { issues: [{ message: `Path must contain: ${names.join(", ")}` }] };
        }
        return { value };
      },
      jsonSchema: {
        input: () => ({
          type: "object",
          properties: Object.fromEntries(names.map(name => [name, { type: ["string", "number", "boolean"] }])),
          required: names,
          additionalProperties: false,
        }),
        output: () => ({}),
      },
    },
  } as StandardSchema;
}
