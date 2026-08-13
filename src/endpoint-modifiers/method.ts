import { Result, TaggedError } from "better-result";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";

/** A standard or custom HTTP method name. */
export type Method =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "OPTIONS"
  | "PATCH"
  | "QUERY"
  | (string & {});

type SomeMethods = [Method, ...Method[]];

type MethodParam<M extends [string, ...string[]]> = M extends [Method]
  ? M[number] | undefined
  : M[number];

/** Reports a method that is not allowed by an endpoint. */
export class InvalidMethodError<ValidMethods extends SomeMethods> extends TaggedError("InvalidMethodError")<{
  method?: string,
  valid: ValidMethods
}> {
  source = "method";
}

// This weird split is necessary because I wanted to make TypeScript suggest standard methods (GET, POST, ...),
// but also allow you to put in any arbitrary string. If you did:
//   function method<Methods extends [Method, ...Method[]]>(...methods: Methods)
// This would give you suggestions for the first one from the list (GET, POST, ...), but the rest would have no
// suggestions. This is solved with function overloads (see below), but I needed the proper inferred ReturnType,
// hence the `createMethodModifier` function's existence.

function createMethodModifier<Methods extends SomeMethods>(...methods: Methods) {
  return createRequestModifier("method")<MethodParam<Methods>>()(
    args => {
      const supplied = args === NO_MODIFIER_ARGS ? undefined : args;
      let method: Method;

      if(supplied) {
        if(!methods.includes(supplied)) return Result.err(new InvalidMethodError({ method: supplied, valid: methods }));
        method = supplied;
      } else {
        if(methods.length === 1) {
          method = methods[0];
        } else {
          return Result.err(new InvalidMethodError({ method: undefined, valid: methods }));
        }
      }

      return Result.ok({
        init: { method }
      });
    },
    methods.length > 1
      ? {
        required: true,
        value: () => ({ type: "string", enum: methods })
      }
      : undefined
  );
}

/**
 * Sets a fixed method or lists the methods accepted by an endpoint call.
 *
 * One method needs no call parameter. With two or more methods, callers must
 * supply the selected method through the endpoint's `method` parameter.
 *
 * @example
 * ```ts
 * api.endpoint(method("GET"), path("/posts"));
 * api.endpoint(method("PUT", "PATCH"), path("/posts/{id}"));
 * ```
 */
export function method<Methods extends SomeMethods>(...methods: Methods): ReturnType<typeof createMethodModifier<Methods>>;
export function method(...methods: SomeMethods): ReturnType<typeof createMethodModifier<SomeMethods>>;
export function method(...methods: SomeMethods) {
  return createMethodModifier(...methods);
}
