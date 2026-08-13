import { Result } from "better-result";
import type { ArrayOr } from "../../dist/index.d.mts";
import { defaultSerializeValue, type URLSafeValue } from "../common";
import { createRequestModifier } from "../endpoint-modifier";

export function constantQuery(values: Record<string, ArrayOr<URLSafeValue | undefined>>) {
  return createRequestModifier("constant-query")()(
    async (_args, url, _init) => {
      for(const [key, value] of Object.entries(values)) {
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
    }
  );
}