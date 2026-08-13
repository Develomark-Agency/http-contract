import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultSerializeValue, type ArrayOr, type Nullable, type Schema, type URLSafeValue } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result } from "better-result";
import { SchemaValidationError } from "../errors";

export function query<
  S extends Schema<
    any,
    Record<string, ArrayOr<Nullable<URLSafeValue>>>
  >
>(schema: S) {
  return createRequestModifier("query")<StandardSchemaV1.InferInput<S>>()(
    async (args, url, init) => {
      const input = (args as unknown) === NO_MODIFIER_ARGS ? {} : args;
      const validated = await schema["~standard"].validate(input);

      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "query", issues: validated.issues }));
      }

      for(const [key, value] of Object.entries(validated.value)) {
        if(Array.isArray(value)) {
          for(const val of value) {
            if(val != null) {
              url.searchParams.append(key, defaultSerializeValue(val));
            }
          }
        } else {
          if(value === null) {
            url.searchParams.set(key, "null");
          } else if(value != null) {
            url.searchParams.set(key, defaultSerializeValue(value));
          } else if(value === undefined) {
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
