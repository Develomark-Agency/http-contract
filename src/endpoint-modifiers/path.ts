import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultSerializeValue, type Schema, type URLSafeValue } from "../common";
import { createRequestModifier, NO_MODIFIER_ARGS } from "../endpoint-modifier";
import { Result, TaggedError } from "better-result";
import { SchemaValidationError } from "../errors";

export namespace PathModifier {
  /** Gets parameter names enclosed in braces in a path template. */
  export type TemplateParameters<Template extends string>
    = Template extends `${string}{${infer Param extends string}}${infer Rest extends string}`
      ? Param | TemplateParameters<Rest>
      : never;
}

type BasePathParameters<Template extends string> = {
  [K in PathModifier.TemplateParameters<Template>]: URLSafeValue
};

/** Reports path parameters that a request did not supply. */
export class MissingPathParameterError extends TaggedError("MissingPathParameterError")<{
  parameters: string[]
}> {
  source = "path";
}

/**
 * Sets an endpoint path and fills values enclosed in braces.
 *
 * Pass a schema to validate and transform path parameters. Without a schema,
 * parameter values may be strings, numbers, booleans, bigints, or dates.
 *
 * @example
 * ```ts
 * const getUser = api.endpoint(
 *   method("GET"),
 *   path("/users/{id}", z.object({ id: z.number().int() }))
 * );
 *
 * await getUser.fetch({ path: { id: 42 } });
 * ```
 */
export function path<
  Template extends string,
  S extends Schema<any, BasePathParameters<Template>> | undefined
>(template: Template, schema?: keyof BasePathParameters<Template> extends never ? never : S) {
  const parameters = extractTemplateValues(template);

  return createRequestModifier("path")<
    undefined extends S
      ? keyof BasePathParameters<Template> extends never
        ? {}
        : BasePathParameters<Template>
      : S extends StandardSchemaV1<any, any>
        ? StandardSchemaV1.InferInput<S>
        : never
  >()(
    async (args, url, _init) => {
      if(args === NO_MODIFIER_ARGS && parameters.length > 0) {
        return Result.err(new MissingPathParameterError({ parameters }));
      }

      const input = (args as unknown) === NO_MODIFIER_ARGS ? {} : args;

      let pathArgs;
      if(schema) {
        const validated = await schema["~standard"].validate(input);
        if(validated.issues) {
          return Result.err(new SchemaValidationError({ source: "path", issues: validated.issues }));
        }

        pathArgs = validated.value;
      } else {
        pathArgs = input;
      }

      url.pathname = replaceTemplateValues(template, pathArgs);

      return Result.ok({ url });
    },
    parameters.length > 0
      ? {
        required: true,
        value: options => {
          if(schema) {
            return schema["~standard"].jsonSchema.input(options);
          }

          return {
            type: "object",
            properties: Object.fromEntries(
              parameters.map(parameter => [parameter, {}])
            ),
            required: parameters
          };
        }
      }
      : undefined
  );
}

const templateRegex = /{(?<key>[^}]*)}/;

function extractTemplateValues(template: string) {
  return [...new Set(
    [...template.matchAll(new RegExp(templateRegex, "g"))]
      .map(match => match.groups?.key)
      .filter((key): key is string => Boolean(key))
  )];
}

function replaceTemplateValues(template: string, args: Record<string, NonNullable<URLSafeValue>>) {
  const match = template.match(templateRegex);

  if(!match || !match[1] || match.index == null || !match.input) {
    if(template.startsWith("/")) return template;
    return "/" + template;
  }
  const { 0: raw, 1: key, index, input } = match;

  const value = args[key];
  let result = input;

  if(value == null) {
    if(input.charAt(index + raw.length) === "/") {
      result = result.slice(0, index) + result.slice(index + raw.length + 1);
    } else if(input.charAt(index - 1) === "/") {
      result = result.slice(0, index - 1) + result.slice(index + raw.length);
    } else {
      result = result.replace(raw, "");
    }
  } else {
    result = result.replace(raw, defaultSerializeValue(value));
  }

  return replaceTemplateValues(result, args);
}
