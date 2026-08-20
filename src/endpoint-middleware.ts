import type { APIConnector } from "./api";
import type { PromiseOr } from "./common";

/** Sends a request to the next endpoint middleware, or to the API fetch function. */
export type EndpointMiddlewareNext = (
  request?: Readonly<APIConnector.RequestContext>
) => Promise<Response>;

/** Runs around an endpoint's resolved HTTP request. */
export type EndpointMiddlewareHandler = (
  request: Readonly<APIConnector.RequestContext>,
  next: EndpointMiddlewareNext
) => PromiseOr<Response>;

/** An endpoint item that can inspect, replace, or skip an HTTP request. */
export interface EndpointMiddleware {
  readonly kind: "middleware",
  readonly run: EndpointMiddlewareHandler
}

/**
 * Runs around the final HTTP request for an endpoint.
 *
 * Request modifiers run first. Calling `next()` continues through the remaining
 * middleware and then sends the request. Returning a response without calling
 * `next()` skips the request. Response modifiers run on the returned response.
 *
 * Pass a request context to `next()` to replace the request seen by later
 * middleware and the API fetch function.
 *
 * @example
 * ```ts
 * const getPost = api.endpoint(
 *   middleware(async (request, next) => {
 *     const key = makeCacheKey(request);
 *     const cached = responseCache.get(key);
 *     if(cached) return cached.clone(); // Body can only be read once
 *
 *     const response = await next();
 *     responseCache.set(key, response.clone());
 *     return response;
 *   }),
 *   method("GET"),
 *   path("/posts/{id}")
 * );
 * ```
 *
 * A cache must keep an unread response or its body data and return a fresh
 * `Response` for each hit. A generic cache that returns the same `Response`
 * more than once cannot safely cache response bodies.
 */
export function middleware(run: EndpointMiddlewareHandler): EndpointMiddleware {
  return { kind: "middleware", run };
}
