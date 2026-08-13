import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { APIConnector } from "./api";
import type { OptionalizeEmpties, RemoveEmpties, RemoveNevers, UnionToIntersection } from "./common";
import { ContractRequest, type RequestParams } from "./contract-request";
import type { AnyEndpointModifier, AnyRequestModifier, callContribution, validContribution } from "./endpoint-modifier";

export namespace Endpoint {
  export type Some = { " ~": { modifiers: AnyEndpointModifier[] } }
  export type ExtractModifiers<E extends Some> = E[" ~"]["modifiers"];

  type InferCall<M extends AnyEndpointModifier[]> = UnionToIntersection<{
    [K in keyof M]: {
      [S in M[K] extends { side: "request" } ? M[K]["tag"] : never]: M[K][typeof callContribution]
    }
  }[number]>

  export type InferCallParams<E extends Some> = RemoveEmpties<
    RemoveNevers<
      OptionalizeEmpties<
        InferCall<E[" ~"]["modifiers"]>
      >
    >
  >

  type InferValid<M extends AnyEndpointModifier[]> = UnionToIntersection<{
    [K in keyof M]: {
      [S in M[K] extends { side: "response" } ? M[K]["tag"] : never]: M[K][typeof validContribution]
    }
  }[number]>

  export type InferValidParams<E extends Some> = RemoveEmpties<
    RemoveNevers<
      OptionalizeEmpties<
        InferValid<E[" ~"]["modifiers"]>
      >
    >
  >
}

export type CheckUniqueKeys<M extends readonly AnyEndpointModifier[], Seen = never> =
  M extends readonly[infer Head extends AnyEndpointModifier, ...infer Tail extends readonly AnyEndpointModifier[]]
    ? `${Head["side"]} ${Head["tag"]}` extends Seen
      ? { readonly "Duplicate endpoint modifier": `${Head["side"]} ${Head["tag"]}` }
      : CheckUniqueKeys<Tail, Seen | `${Head["side"]} ${Head["tag"]}`>
    : unknown;

export class Endpoint<
  const Modifiers extends AnyEndpointModifier[]
> {
  " ~";
  constructor(
    private api: APIConnector,
    ...modifiers: Modifiers & CheckUniqueKeys<Modifiers>
  ) {
    this[" ~"] = { modifiers: modifiers as Modifiers }
  }

  async request(...[params, init]: RequestParams<this>): Promise<ContractRequest<this>> {
    return ContractRequest["from"](this, params, init);
  }

  async fetch(...args: RequestParams<this>) {
    const req = await this.request(...args);
    const res = await req.run();
    return res;
  }

  toJSONSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    const requestModifiers = this[" ~"].modifiers.filter(
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

    return {
      type: "object",
      properties: Object.fromEntries(
        schemas.map(schema => [
          schema.tag,
          schema.value
        ])
      ),
      ...(required.length > 0 ? { required } : {})
    };
  }
}
