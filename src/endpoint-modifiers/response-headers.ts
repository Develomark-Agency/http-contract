import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ArrayOr, Schema, URLSafeValue } from "../common";
import { createResponseModifier } from "../endpoint-modifier";
import { Result } from "better-result";
import { SchemaValidationError } from "../errors";

export function headersToRecord(headers: string[][] | Record<string, string | readonly string[] | undefined> | Headers) {
  return Object.fromEntries(headers instanceof Headers ? headers : Object.entries(headers));
}

/**
 * Validates response headers and exposes the parsed result on `response.valid.headers`.
 * A schema transform can select or reshape headers instead of returning the full
 * record.
 *
 * @example
 * ```ts
 * const endpoint = api.endpoint(
 *   responseHeaders(z.record(z.string(), z.string()))
 * );
 * const response = await endpoint.fetch();
 * console.log(response.valid.headers["content-type"]);
 * ```
 */
export function responseHeaders<
  S extends Schema<Record<string, ArrayOr<URLSafeValue>>, any>
>(schema: S) {
  return createResponseModifier("headers")(
    async res => {
      const rawHeaders = headersToRecord(res.headers);
      const validated = await schema["~standard"].validate(rawHeaders);

      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "response-headers", issues: validated.issues }));
      }

      return Result.ok(validated.value as StandardSchemaV1.InferOutput<S>);
    }
  );
}
