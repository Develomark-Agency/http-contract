import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { BodyReaderOutput, Schema } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result } from "better-result";
import { BodySerializationError, SchemaValidationError } from "../errors";

type AnyBody = BodyReaderOutput[keyof BodyReaderOutput];

type Transform<S extends Schema<any, AnyBody> | undefined>
  = ((body: S extends Schema<any, any> ? StandardSchemaV1.InferOutput<S> : any) => any);

type RequestBodyParams<
  S extends Schema<any, AnyBody> | undefined,
  T extends Transform<S> | undefined
> = [transform?: T] | [schema: S, transform?: T];

export function requestBody<
  S extends Schema<any, AnyBody> | undefined,
  T extends Transform<S> | undefined
>(...[argA, argB]: RequestBodyParams<S, T>) {
  let schema, transform;
  if(argA && typeof argA === "function") {
    transform = argA;
  } else {
    schema = argA;
    transform = argB;
  }

  const args = { schema, transform } as { schema: S, transform: T };

  type CallParams = S extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<S>
    : T extends (body: infer Input, ...args: any[]) => any
      ? Input
      : AnyBody;

  return createRequestModifier("body")<CallParams>()(async (data, url, init) => {
    const input = data === NO_MODIFIER_ARGS ? undefined : data;
    
    let output = input as AnyBody | undefined;

    if(args.schema) {
      const validated = await args.schema["~standard"].validate(input);
      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "request-body", issues: validated.issues }));
      }

      output = validated.value;
    }

    if(args.transform) {
      try {
        output = await args.transform(output as any);
      } catch(e) {
        return Result.err(new BodySerializationError({ source: "request-body" as const, cause: e }));
      }
    }

    const contentType = getContentType(output);
    try {
      const body = serializeBody(output);
  
      return Result.ok({
        init: {
          body,
          headers: { "Content-Type": contentType }
        }
      });
    } catch(e) {
      return Result.err(new BodySerializationError({ source: "request-body", cause: e }));
    }
  });
}

function getContentType(value: any) {
  if(typeof value === "string") return "text/plain;charset=UTF-8";
  if(
    value instanceof ArrayBuffer
    || value instanceof Uint8Array
    || value instanceof Blob
  ) return "application/octet-stream";

  if(value instanceof FormData) return;
  return "application/json";
}

function serializeBody(value?: AnyBody) {
  if(value === undefined) return undefined;
  if(
    typeof value === "string"
    || value instanceof ArrayBuffer
    || value instanceof Blob
    || value instanceof Uint8Array
    || value instanceof FormData
  ) return value;

  return JSON.stringify(value);
}
