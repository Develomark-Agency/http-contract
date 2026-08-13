import { resolvePrimitive, resolvePrimitiveRecord, type FetchLike, type GetterOr, type URLSafeValue } from "./common";
import type { AnyEndpointModifier } from "./endpoint-modifier";
import { Endpoint, type CheckUniqueKeys } from "./endpoint";

export namespace APIConnector {
  export interface RequestContext {
    url: URL,
    init: RequestInit
  }

  export interface ResponseContext {
    res: Response,
    url: URL,
    init: RequestInit
  }

  export type Config = GetterOr<{
    baseUrl: GetterOr<string>,
    headers?: GetterOr<Record<string, GetterOr<string>>>,
    query?: GetterOr<Record<string, GetterOr<URLSafeValue>>>,
    fetch?: FetchLike
  }>
}

export class APIConnector {
  constructor(private readonly config: APIConnector.Config) {}

  private async resolveConfig() {
    const cfg = typeof this.config === "function"
      ? await this.config()
      : this.config;
    
    const [baseUrl, headers, query] = await Promise.all([
      resolvePrimitive(cfg.baseUrl),
      resolvePrimitiveRecord(cfg.headers ?? {}),
      resolvePrimitiveRecord(cfg.query ?? {})
    ]);

    return {
      baseUrl,
      headers,
      query,
      fetch: cfg.fetch ?? globalThis.fetch
    }
  }

  endpoint<
    const Modifiers extends AnyEndpointModifier[]
>(...modifiers: Modifiers & CheckUniqueKeys<Modifiers>) {
    return new Endpoint<Modifiers>(this, ...modifiers);
  }
}