import { resolvePrimitive, resolvePrimitiveRecord, type FetchLike, type GetterOr, type URLSafeValue } from "./common";
import { Endpoint, type AnyEndpointItem, type CheckUniqueKeys } from "./endpoint";

export namespace APIConnector {
  /** The request state passed through an API connector. */
  export interface RequestContext {
    url: URL,
    init: RequestInit
  }

  /** The response state returned through an API connector. */
  export interface ResponseContext {
    res: Response,
    url: URL,
    init: RequestInit
  }

  /** Static or lazy settings used for every endpoint on a connector. */
  export type Config = GetterOr<{
    baseUrl: GetterOr<string>,
    headers?: GetterOr<Record<string, GetterOr<string>>>,
    query?: GetterOr<Record<string, GetterOr<URLSafeValue>>>,
    fetch?: FetchLike
  }>;
}

/**
 * Defines a group of HTTP endpoints that share a base URL and request settings.
 *
 * Settings may be values or functions, which makes it possible to read fresh
 * authentication data for each request. Pass a custom `fetch` implementation
 * to test requests or run the connector in a non-browser runtime.
 *
 * @example
 * ```ts
 * const api = new APIConnector({
 *   baseUrl: "https://api.example.com",
 *   headers: () => ({ Authorization: `Bearer ${getToken()}` })
 * });
 *
 * const getUser = api.endpoint(method("GET"), path("/users/{id}"));
 * ```
 */
export class APIConnector {
  /**
   * Creates a connector from static or lazy settings.
   *
   * The connector resolves the config, base URL, headers, and query values when
   * a request runs. It does not resolve them when an endpoint is declared.
   */
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
    };
  }

  /**
   * Creates a typed endpoint from request modifiers, middleware, and response
   * modifiers.
   *
   * Request modifiers run first. Middleware then nests in declaration order
   * around the HTTP request. Response modifiers run last. TypeScript rejects
   * two modifiers with the same side and tag.
   */
  endpoint<
    const Items extends AnyEndpointItem[]
  >(...items: Items & CheckUniqueKeys<Items>) {
    return new Endpoint<Items>(this, ...items);
  }
}
