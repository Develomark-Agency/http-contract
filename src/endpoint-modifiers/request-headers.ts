import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultSerializeValue, type ArrayOr, type Nullable, type Schema, type URLSafeValue } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result } from "better-result";
import { SchemaValidationError } from "../errors";

export function requestHeaders<
  S extends Schema<any, Record<string, ArrayOr<Nullable<URLSafeValue>>>>
>(schema: S) {
  return createRequestModifier("headers")<StandardSchemaV1.InferInput<S>>()(
    async (args, url, init) => {
      const input = (args as unknown) === NO_MODIFIER_ARGS ? {} : args;
      const validated = await schema["~standard"].validate(input);

      if(validated.issues) {
        return Result.err(new SchemaValidationError({ source: "request-headers", issues: validated.issues }));
      }

      const headers = new Headers();

      for(const [key, value] of Object.entries(validated.value)) {
        if(Array.isArray(value)) {
          headers.delete(key);
          for(const val of value) {
            if(val === null) {
              headers.append(key, "null");
            } else if(val != null) {
              headers.append(key, defaultSerializeValue(val));
            }
          }
        } else {
          if(value === null) {
            headers.append(key, "null");
          } else if(value != null) {
            headers.append(key, defaultSerializeValue(value));
          } else if(value === undefined) {
            headers.delete(key);
          }
        }
      }

      return Result.ok({
        init: { headers }
      });
    }
  );
}
