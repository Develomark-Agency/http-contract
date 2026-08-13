import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultSerializeValue, type ArrayOr, type Schema, type URLSafeValue } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result } from "better-result";
import { SchemaValidationError } from "../errors";

/**
 * Validates endpoint call input and writes it to the URL query string.
 *
 * Array values produce repeated query parameters. An `undefined` value removes
 * a parameter that may have come from the connector's shared config.
 *
 * @example
 * ```ts
 * const search = api.endpoint(
 *   method("GET"),
 *   path("/search"),
 *   query(z.object({ q: z.string(), page: z.number().optional() }))
 * );
 *
 * await search.fetch({ query: { q: "schema", page: 2 } });
 * ```
 */
export function query<
  S extends Schema<
    any,
    Record<string, ArrayOr<URLSafeValue | undefined>>
  >
>(schema: S) {
  return createRequestModifier("query")<StandardSchemaV1.InferInput<S>>()(
    async (args, url, _init) => {
      const input = (args as unknown) === NO_MODIFIER_ARGS ? {} : args;
      const validated = await schema["~standard"].validate(input);

      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "query", issues: validated.issues }));
      }

      for(const [key, value] of Object.entries(validated.value)) {
        if(Array.isArray(value)) {
          for(const val of value) {
            if(val !== undefined) {
              url.searchParams.append(key, defaultSerializeValue(val));
            }
          }
        } else {
          if(value !== undefined) {
            url.searchParams.set(key, defaultSerializeValue(value));
          } else {
            url.searchParams.delete(key);
          }
        }
      }

      return Result.ok({ url });
    },
    {
      required: true,
      value: options => schema["~standard"].jsonSchema.input(options)
    }
  );
}
