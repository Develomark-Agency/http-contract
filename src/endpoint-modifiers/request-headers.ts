import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultSerializeValue, type ArrayOr, type HeaderPatch, type Schema, type URLSafeValue } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result } from "better-result";
import { SchemaValidationError } from "../errors";

/**
 * Validates endpoint call input and applies it to request headers.
 *
 * Array values append more than one value. An `undefined` value removes a
 * header that may have come from connector config or an earlier modifier.
 *
 * @example
 * ```ts
 * const endpoint = api.endpoint(
 *   requestHeaders(z.object({ "X-Request-Id": z.string() }))
 * );
 *
 * await endpoint.fetch({ headers: { "X-Request-Id": crypto.randomUUID() } });
 * ```
 */
export function requestHeaders<
  S extends Schema<any, Record<string, ArrayOr<URLSafeValue | undefined>>>
>(schema: S) {
  return createRequestModifier("headers")<StandardSchemaV1.InferInput<S>>()(
    async (args, _url, _init) => {
      const input = (args as unknown) === NO_MODIFIER_ARGS ? {} : args;
      const validated = await schema["~standard"].validate(input);

      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "request-headers", issues: validated.issues }));
      }

      const headers: HeaderPatch = {};

      for(const [key, value] of Object.entries(validated.value)) {
        if(Array.isArray(value)) {
          headers[key] = value
            .filter(val => val !== undefined)
            .map(defaultSerializeValue);
        } else {
          headers[key] = value === undefined
            ? undefined
            : defaultSerializeValue(value);
        }
      }

      return Result.ok({
        headers
      });
    },
    {
      required: true,
      value: options => schema["~standard"].jsonSchema.input(options)
    }
  );
}
