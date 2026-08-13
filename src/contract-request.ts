import type { Endpoint } from "./endpoint";
import { applyHeaderPatch, defaultSerializeValue } from "./common";
import { NO_MODIFIER_ARGS, type AnyEndpointModifier } from "./endpoint-modifier";
import { NetworkError } from "./errors";
import { ContractResponse } from "./contract-response";

export namespace ContractRequest {
  /** Request settings excluding fields controlled by endpoint modifiers. */
  export type Init<RemoveKeys extends PropertyKey> = Omit<RequestInit, RemoveKeys>;
}

/** The argument tuple accepted by an endpoint request. */
export type RequestParams<E extends Endpoint<AnyEndpointModifier[]>> = {} extends Endpoint.InferCallParams<E>
  ? [params?: Endpoint.InferCallParams<E>, init?: ContractRequest.Init<keyof Endpoint.InferCallParams<E>>]
  : [params: Endpoint.InferCallParams<E>, init?: ContractRequest.Init<keyof Endpoint.InferCallParams<E>>];

/**
 * A prepared endpoint request that can be sent when ready.
 *
 * Create one with `Endpoint.request()`. This split is useful when code needs to
 * pass a request around before sending it; use `Endpoint.fetch()` for the common
 * build-and-send case.
 */
export class ContractRequest<E extends Endpoint<AnyEndpointModifier[]>> {
  #params;

  private constructor(
    private endpoint: E,
    params?: Endpoint.InferCallParams<E>,
    private init?: ContractRequest.Init<keyof Endpoint.InferCallParams<E>>
  ) {
    this.#params = params;
  }

  private get params() {
    return this.#params as Endpoint.InferCallParams<E> | ({} extends Endpoint.InferCallParams<E> ? undefined : never);
  }

  private static from<E extends Endpoint<AnyEndpointModifier[]>>(
    endpoint: E,
    params?: Endpoint.InferCallParams<E>,
    init?: ContractRequest.Init<keyof Endpoint.InferCallParams<E>>
  ) {
    return new ContractRequest(endpoint, params, init);
  }

  /**
   * Resolves the request URL without sending the request.
   */
  async url() {
    const { url } = await this.resolveRequest();
    return url;
  }

  private async resolveRequest() {
    const modifiers = this.endpoint[" ~"]["modifiers"];
    const api = this.endpoint["api"];
    const params = this.params as Record<string, unknown>;
    const initFromRequest: RequestInit = this.init ?? {};

    const { baseUrl, headers, query, fetch } = await api["resolveConfig"]();

    let url = new URL(baseUrl);

    for(const [k, v] of Object.entries(query)) {
      if(Array.isArray(v)) {
        url.searchParams.append(k, defaultSerializeValue(v));
      } else {
        url.searchParams.set(k, defaultSerializeValue(v));
      }
    }

    let init: RequestInit = {
      ...initFromRequest,
      headers: applyHeaderPatch(initFromRequest.headers, headers)
    };

    for(const mod of modifiers) {
      const args = params != null && Object.hasOwn(params, mod.tag)
        ? params[mod.tag]
        : NO_MODIFIER_ARGS;

      const { headers: initHeaders, ...initWithoutHeaders } = init;
      const initForModifier: RequestInit = {
        ...structuredClone(initWithoutHeaders),
        headers: new Headers(initHeaders)
      };
      const result = await mod.modifyRequest(args, new URL(url.href), initForModifier);
      if(!result) continue;

      if(result.isOk()) {
        if(result.value.url) url = result.value.url;
        if(result.value.init) {
          init = { ...init, ...result.value.init };
        }
        if(result.value.headers) {
          init = {
            ...init,
            headers: applyHeaderPatch(init.headers, result.value.headers)
          };
        }
      } else {
        throw result.error;
      }
    }

    return { url, init, fetch };
  }

  /**
   * Applies each request modifier, sends the request, then applies each response
   * modifier. Throws the modifier error or `NetworkError` when a step fails.
   */
  async run() {
    const modifiers = this.endpoint[" ~"]["modifiers"];
    const { url, init, fetch } = await this.resolveRequest();

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new NetworkError({ cause: e });
    }

    const valid: Record<PropertyKey, unknown> = {};
    for(const mod of modifiers) {
      const result = await mod.modifyResponse(res);
      if(!result) continue;

      if(result.isOk()) {
        valid[mod.tag] = result.value;
      } else {
        throw result.error;
      }
    }

    return ContractResponse["from"](this.endpoint, res, valid as any);
  }
}
