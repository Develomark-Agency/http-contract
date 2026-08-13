import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { BodyReader, BodyReaderOutput, Schema } from "../common";
import { createResponseModifier } from "../endpoint-modifier";
import { Result } from "better-result";
import { BodyReadError, SchemaValidationError } from "../errors";

type Transform<B extends BodyReader, S extends Schema<BodyReaderOutput[B], any> | undefined>
  = ((body: S extends Schema<any, any> ? StandardSchemaV1.InferOutput<S> : BodyReaderOutput[B]) => any)

type ResponseBodyParams<
  B extends BodyReader,
  S extends Schema<BodyReaderOutput[B], any> | undefined,
  T extends Transform<B, S> | undefined
> =
  | [reader: B, transform?: T]
  | [reader: B, schema: S, transform?: T]
  | [schema: S, transform?: T];

type ReadResult<
  B extends BodyReader,
  S extends Schema<BodyReaderOutput[B], any> | undefined,
  T extends Transform<B, S> | undefined
> = undefined extends T
  ? undefined extends S
    ? BodyReaderOutput[B]
    : S extends Schema<any, any>
      ? StandardSchemaV1.InferOutput<S>
      : never
  : Awaited<ReturnType<T & Function>>

export function responseBody<
  B extends BodyReader,
  S extends Schema<BodyReaderOutput[B], any> | undefined,
  T extends Transform<B, S> | undefined
>(...[argA, argB, argC]: ResponseBodyParams<B, S, T>) {

  let reader, schema, transform;
  if(typeof argA === "string") {
    reader = argA;
    if(argB && typeof argB === "function") {
      transform = argB;
    } else {
      schema = argB;
      transform = argC;
    }
  } else {
    reader = "json" as const;
    schema = argA;
    transform = argB as T | undefined;
  }

  const args = { reader, schema, transform } as
    | { reader: B, schema: undefined, transform: T }
    | { reader: B, schema: S, transform: T }
    | { reader: "json", schema: undefined, transform: T }

  return createResponseModifier("body")(async res => {

    async function safeRead() {
      let readResult;
      try {
        readResult = await res[args.reader]();
      } catch(e) {
        return Result.err(new BodyReadError({ source: "response-body", cause: e }));
      }

      let output;

      if(args.schema) {
        const validated = await args.schema["~standard"].validate(readResult);
        
        if(validated.issues) {
          return Result.err(new SchemaValidationError({ source: "response-body", issues: validated.issues }));
        }

        output = validated.value;
      } else {
        output = readResult;
      }
    
      if(args.transform) {
        try {
          const transformed = await args.transform(output as any);
          return Result.ok(transformed as ReadResult<B, S, T>);
        } catch(e) {
          return Result.err(new BodyReadError({ source: "response-body", cause: e }));
        }
      } else {
        return Result.ok(output as ReadResult<B, S, T>);
      }
    }

    async function read() {
      const res = await safeRead();

      if(res.isOk()) return res.value;

      throw res.error;
    }

    read.safe = safeRead;

    return Result.ok(read);
  });
}
