import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { APIConnector } from "./api";
import type { OptionalizeEmpties, RemoveEmpties, RemoveNevers, UnionToIntersection } from "./common";
import { ContractRequest, type RequestParams } from "./contract-request";
import type { AnyEndpointModifier, AnyRequestModifier, callContribution, validContribution } from "./endpoint-modifier";
import type { EndpointMiddleware } from "./endpoint-middleware";

/** A request modifier, response modifier, or middleware accepted by an endpoint. */
export type AnyEndpointItem = AnyEndpointModifier | EndpointMiddleware;

type ExtractItemModifiers<Items extends readonly AnyEndpointItem[]> =
  number extends Items["length"]
    ? Array<Extract<Items[number], AnyEndpointModifier>>
    : Items extends readonly[
      infer Head extends AnyEndpointItem,
      ...infer Tail extends readonly AnyEndpointItem[]
    ]
      ? Head extends AnyEndpointModifier
        ? [Head, ...ExtractItemModifiers<Tail>]
        : ExtractItemModifiers<Tail>
      : [];

export namespace Endpoint {
  /** Any endpoint shape from which modifier types can be read. */
  export type Some = { " ~": { modifiers: AnyEndpointModifier[] } };
  /** An endpoint shape that can build and send a request. */
  export type Runnable = Some & {
    " ~": Some[" ~"] & {
      api: APIConnector,
      middlewares: EndpointMiddleware[]
    }
  };
  /** An endpoint shape that can produce a JSON Schema. */
  export type Adaptable = Some & {
    toJSONSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown>
  };
  /** Gets the modifier tuple from an endpoint type. */
  export type ExtractModifiers<E extends Some> = E[" ~"]["modifiers"];

  type InferCall<M extends AnyEndpointModifier[]> = UnionToIntersection<{
    [K in keyof M]: {
      [S in M[K] extends { side: "request" } ? M[K]["tag"] : never]: M[K][typeof callContribution]
    }
  }[number]>;

  /** Infers the parameters accepted when an endpoint sends a request. */
  export type InferCallParams<E extends Some> = RemoveEmpties<
    RemoveNevers<
      OptionalizeEmpties<
        InferCall<E[" ~"]["modifiers"]>
      >
    >
  >;

  type InferValid<M extends AnyEndpointModifier[]> = UnionToIntersection<{
    [K in keyof M]: {
      [S in M[K] extends { side: "response" } ? M[K]["tag"] : never]: M[K][typeof validContribution]
    }
  }[number]>;

  /** Infers the validated values exposed by an endpoint response. */
  export type InferValidParams<E extends Some> = RemoveEmpties<
    RemoveNevers<
      OptionalizeEmpties<
        InferValid<E[" ~"]["modifiers"]>
      >
    >
  >;
}

/** Reports duplicate request or response modifier tags at compile time. */
export type CheckUniqueKeys<Items extends readonly AnyEndpointItem[], Seen = never> =
  Items extends readonly[infer Head extends AnyEndpointItem, ...infer Tail extends readonly AnyEndpointItem[]]
    ? Head extends AnyEndpointModifier
      ? `${Head["side"]} ${Head["tag"]}` extends Seen
        ? { readonly "Duplicate endpoint modifier": `${Head["side"]} ${Head["tag"]}` }
        : CheckUniqueKeys<Tail, Seen | `${Head["side"]} ${Head["tag"]}`>
      : CheckUniqueKeys<Tail, Seen>
    : unknown;

/**
 * A typed HTTP operation built from request modifiers, middleware, and response
 * modifiers.
 *
 * Request modifiers determine the parameters accepted by `request()` and
 * `fetch()`. Middleware can inspect, replace, or skip the HTTP request. Response
 * modifiers determine the values available through `ContractResponse.valid`.
 *
 * @example
 * ```ts
 * const getPost = api.endpoint(
 *   method("GET"),
 *   path("/posts/{id}"),
 *   responseBody(postSchema)
 * );
 *
 * const response = await getPost.fetch({ path: { id: 1 } });
 * const post = await response.valid.body();
 * ```
 */
export class Endpoint<
  const Items extends AnyEndpointItem[]
> {
  " ~": {
    api: APIConnector,
    modifiers: ExtractItemModifiers<Items>,
    middlewares: EndpointMiddleware[]
  };
  /** Creates an endpoint. Prefer `APIConnector.endpoint()` so types infer cleanly. */
  constructor(
    api: APIConnector,
    ...items: Items & CheckUniqueKeys<Items>
  ) {
    const modifiers = items.filter(item => "side" in item);
    const middlewares = items.filter(item => "kind" in item && item.kind === "middleware");

    this[" ~"] = {
      api,
      modifiers: modifiers as unknown as ExtractItemModifiers<Items>,
      middlewares: middlewares as EndpointMiddleware[]
    };
  }

  /**
   * Builds a request without sending it.
   * Call `run()` on the returned request when it is ready to send.
   */
  async request(...[params, init]: RequestParams<this>): Promise<ContractRequest<this>> {
    return ContractRequest["from"](this, params, init);
  }

  /**
   * Builds and sends a request, then returns its typed response.
   * This is the short form of calling `request()` followed by `run()`.
   */
  async fetch(...args: RequestParams<this>) {
    const req = await this.request(...args);
    const res = await req.run();
    return res;
  }

  /**
   * Returns a JSON Schema for the endpoint's request parameters.
   *
   * Each modifier schema is stored in `$defs` or `definitions`, depending on
   * the requested draft. Local references are rebased to stay within that
   * modifier's definition.
   */
  toJSONSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    const modifiers = this[" ~"].modifiers as AnyEndpointModifier[];
    const requestModifiers = modifiers.filter(
      (modifier): modifier is AnyRequestModifier => modifier.side === "request"
    );
    const schemas = requestModifiers.flatMap(modifier => {
      if(!modifier.jsonSchema) return [];

      return [{
        tag: modifier.tag,
        required: modifier.jsonSchema.required,
        value: modifier.jsonSchema.value(options)
      }];
    });
    const required = schemas
      .filter(schema => schema.required)
      .map(schema => schema.tag);

    const definitionsKey = options.target === "draft-2020-12" ? "$defs" : "definitions";
    const definitions = Object.fromEntries(schemas.map(schema => {
      const reference = `#/${definitionsKey}/${escapeJSONPointer(schema.tag)}`;
      return [schema.tag, rebaseReferences(schema.value, reference)];
    }));

    return {
      type: "object",
      properties: Object.fromEntries(
        schemas.map(schema => [schema.tag, {
          $ref: `#/${definitionsKey}/${escapeJSONPointer(schema.tag)}`
        }])
      ),
      ...(schemas.length > 0 ? { [definitionsKey]: definitions } : {}),
      ...(required.length > 0 ? { required } : {})
    };
  }
}

function rebaseReferences(value: unknown, root: string): unknown {
  if(Array.isArray(value)) {
    return value.map(item => rebaseReferences(item, root));
  }

  if(typeof value !== "object" || value === null) return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "$ref" && typeof child === "string" && (child === "#" || child.startsWith("#/"))
      ? root + child.slice(1)
      : rebaseReferences(child, root)
  ]));
}

function escapeJSONPointer(value: string) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
