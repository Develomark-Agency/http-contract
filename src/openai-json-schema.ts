import { Adapter } from "./adapter";
import type { Endpoint } from "./endpoint";

type JSONSchema = boolean | Record<string, any>;

/**
 * Adapts endpoint parameters to OpenAI's strict JSON Schema rules.
 *
 * OpenAI requires every object field to be present and forbids extra fields.
 * This adapter represents optional endpoint fields as nullable fields, then
 * removes those null placeholders in `decode()` before the endpoint is called.
 * The `schema` property is built lazily and rejects unsupported schema forms.
 *
 * @example
 * ```ts
 * const adapter = new OpenAIJSONSchemaAdapter(listPosts);
 *
 * const endpointTool = tool({
 *   inputSchema: jsonSchema(adapter.schema),
 *   execute: (input: unknown) => listPosts.fetch(adapter.decode(input))
 * });
 * ```
 */
export class OpenAIJSONSchemaAdapter<
  E extends Endpoint.Adaptable
> extends Adapter<E, Record<string, unknown>> {
  protected override readonly target = "draft-2020-12";

  protected override createSchema(source: Record<string, unknown>) {
    const schema = makeStrict(source, source, "$");

    if(typeof schema !== "object" || schema === null || Array.isArray(schema)) {
      throw new TypeError("An OpenAI input schema must be an object schema");
    }

    return schema;
  }

  /**
   * Removes null placeholders that represent omitted optional parameters.
   * Nulls remain intact when the endpoint schema truly allows `null`.
   */
  override decode(value: unknown): Endpoint.InferCallParams<E> {
    return decode(value, this.sourceSchema, this.sourceSchema) as Endpoint.InferCallParams<E>;
  }
}

const unsupported = new Set([
  "allOf", "not", "dependentRequired", "dependentSchemas",
  "if", "then", "else", "patternProperties", "prefixItems", "contains",
  "propertyNames", "unevaluatedProperties", "unevaluatedItems", "uniqueItems"
]);

function makeStrict(schema: JSONSchema, root: JSONSchema, path: string): JSONSchema {
  if(typeof schema === "boolean") return schema;
  if(!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError(`Expected a JSON Schema at ${path}`);
  }
  if(typeof schema.$ref === "string") follow(schema.$ref, root);

  const properties = schema.properties;
  const object = schema.type === "object"
    || properties && typeof properties === "object" && !Array.isArray(properties);

  if(object && "additionalProperties" in schema && schema.additionalProperties !== false) {
    throw new TypeError(`OpenAI strict schemas do not support additional properties at ${path}`);
  }
  for(const key of unsupported) {
    if(key in schema) throw new TypeError(`OpenAI strict schemas do not support ${key} at ${path}`);
  }

  const output: Record<string, unknown> = {};
  for(const [key, value] of Object.entries(schema)) {
    if(key === "$schema" || key === "~standard" || key === "required" || key === "additionalProperties") continue;

    if(key === "properties" || key === "$defs" || key === "definitions") {
      if(!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`Expected schemas at ${path}.${key}`);
      }
      output[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [
        name,
        makeStrict(child as JSONSchema, root, `${path}.${key}.${name}`)
      ]));
    } else if(key === "items") {
      output.items = makeStrict(value as JSONSchema, root, `${path}.items`);
    } else if(key === "anyOf" || key === "oneOf") {
      if(!Array.isArray(value)) throw new TypeError(`Expected schemas at ${path}.anyOf`);
      output.anyOf = value.map((child, index) => makeStrict(child as JSONSchema, root, `${path}.anyOf[${index}]`)
      );
    } else {
      output[key] = value;
    }
  }

  if(!object) return output;
  if(properties != null && (typeof properties !== "object" || Array.isArray(properties))) {
    throw new TypeError(`Expected schemas at ${path}.properties`);
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const strictProperties = output.properties as Record<string, JSONSchema> ?? {};

  for(const [name, child] of Object.entries(strictProperties)) {
    const source = properties[name] as JSONSchema;
    if(!required.has(name) && !acceptsNull(source, root)) {
      strictProperties[name] = { anyOf: [child, { type: "null" }] };
    }
  }

  output.properties = strictProperties;
  output.required = Object.keys(strictProperties);
  output.additionalProperties = false;
  return output;
}

function decode(value: unknown, schema: JSONSchema, root: JSONSchema): unknown {
  if(value === null || typeof schema === "boolean") return value;
  if(typeof schema.$ref === "string") schema = follow(schema.$ref, root);
  if(typeof schema === "boolean") return value;

  const alternatives = schema.anyOf ?? schema.oneOf;
  if(Array.isArray(alternatives)) {
    const matches = (alternatives as JSONSchema[]).filter(child => matchesSchema(value, child, root));
    if(matches.length === 1) return decode(value, matches[0]!, root);
  }

  if(Array.isArray(value) && schema.items != null) {
    return value.map(item => decode(item, schema.items as JSONSchema, root));
  }

  if(typeof value !== "object" || Array.isArray(value) || value === null) return value;
  if(!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return value;

  const output: Record<string, unknown> = { ...value };
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);

  for(const [name, child] of Object.entries(schema.properties as Record<string, JSONSchema>)) {
    if(!Object.hasOwn(output, name)) continue;
    if(output[name] === null && !required.has(name) && !acceptsNull(child, root)) {
      delete output[name];
    } else {
      output[name] = decode(output[name], child, root);
    }
  }

  return output;
}

function acceptsNull(schema: JSONSchema, root: JSONSchema, seen = new Set<string>()): boolean {
  if(schema === true) return true;
  if(schema === false) return false;
  if(schema.const !== undefined) return schema.const === null;
  if(Array.isArray(schema.enum)) return schema.enum.includes(null);

  if(typeof schema.$ref === "string") {
    if(seen.has(schema.$ref)) return false;
    return acceptsNull(follow(schema.$ref, root), root, new Set(seen).add(schema.$ref));
  }

  if(typeof schema.type === "string") return schema.type === "null";
  if(Array.isArray(schema.type)) return schema.type.includes("null");
  const alternatives = schema.anyOf ?? schema.oneOf;
  if(Array.isArray(alternatives)) return alternatives.some(child => acceptsNull(child, root, seen));
  return true;
}

function matchesSchema(value: unknown, schema: JSONSchema, root: JSONSchema): boolean {
  if(typeof schema === "boolean") return schema;
  if(typeof schema.$ref === "string") schema = follow(schema.$ref, root);
  if(typeof schema === "boolean") return schema;
  if("const" in schema && !Object.is(value, schema.const)) return false;
  if(Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if(Array.isArray(schema.anyOf) && !(schema.anyOf as JSONSchema[]).some(child => matchesSchema(value, child, root))) return false;

  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if(Array.isArray(types) && !types.some(type => type === "null" ? value === null
    : type === "array" ? Array.isArray(value)
      : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
        : type === "integer" ? typeof value === "number" && Number.isInteger(value)
          : typeof value === type
  )) return false;

  if(value && typeof value === "object" && !Array.isArray(value) && schema.properties) {
    const object = value as Record<string, unknown>;
    const properties = schema.properties as Record<string, JSONSchema>;
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    if([...required].some(name => !Object.hasOwn(object, name))) return false;
    if(Object.keys(object).some(name => !Object.hasOwn(properties, name))) return false;
    for(const [name, child] of Object.entries(properties)) {
      if(
        Object.hasOwn(object, name)
        && !(object[name] === null && !required.has(name) && !acceptsNull(child, root))
        && !matchesSchema(object[name], child, root)
      ) return false;
    }
  }

  return true;
}

function follow(reference: string, root: JSONSchema): JSONSchema {
  if(reference === "#") return root;
  if(!reference.startsWith("#/")) throw new TypeError(`Only local JSON Schema references are supported: ${reference}`);

  let value: any = root;
  for(const part of reference.slice(2).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if(!value || typeof value !== "object" || !Object.hasOwn(value, key)) {
      throw new TypeError(`JSON Schema reference not found: ${reference}`);
    }
    value = value[key];
  }
  if(typeof value === "boolean" || value && typeof value === "object" && !Array.isArray(value)) return value;
  throw new TypeError(`JSON Schema reference not found: ${reference}`);
}
