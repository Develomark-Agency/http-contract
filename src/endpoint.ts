import type { APIConnector } from "./api";
import type { OptionalizeEmpties, RemoveEmpties, RemoveNevers, UnionToIntersection } from "./common";
import { ContractRequest, type RequestParams } from "./contract-request";
import type { AnyEndpointModifier, callContribution, validContribution } from "./endpoint-modifier";

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
}
