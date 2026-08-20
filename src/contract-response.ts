import type { Endpoint } from "./endpoint";

/**
 * A standard `Response` with values produced by response modifiers.
 *
 * Native response fields and body readers delegate to the underlying response.
 * Validated body and header readers are available through `valid`.
 *
 * @example
 * ```ts
 * const response = await getPost.fetch({ path: { id: 1 } });
 * console.log(response.status);
 * const post = await response.valid.body();
 * ```
 */
export class ContractResponse<E extends Endpoint.Some> implements Response {
  #response;
  #valid;
  #params;

  private constructor(
    private endpoint: E,
    response: Response,
    valid: Endpoint.InferValidParams<E>,
    params: Endpoint.InferCallParams<E>
  ) {
    this.#response = response;
    this.#valid = valid;
    this.#params = params;
  }

  /** Wraps a response and the values produced by its response modifiers. */
  static from<E extends Endpoint.Some>(
    endpoint: E,
    response: Response,
    valid: Endpoint.InferValidParams<E>,
    params: Endpoint.InferCallParams<E>
  ) {
    return new ContractResponse(endpoint, response, valid, params);
  }

  /** Whether the response status is in the successful range. */
  get ok() { return this.#response.ok; }
  /** The HTTP response status code. */
  get status() { return this.#response.status; }
  /** The HTTP response status text. */
  get statusText() { return this.#response.statusText; }
  /** The final response URL. */
  get url() { return this.#response.url; }
  /** The response headers. */
  get headers() { return this.#response.headers; }
  /** The response type. */
  get type() { return this.#response.type; }
  /** Whether a response body reader has consumed the body. */
  get bodyUsed() { return this.#response.bodyUsed; }
  /** The response body stream, or `null` when none exists. */
  get body() { return this.#response.body; }
  /** Whether fetch followed a redirect. */
  get redirected() { return this.#response.redirected; }
  /** Clones the underlying response. */
  clone() { return this.#response.clone(); }
  /** Reads the response body as text. */
  text() { return this.#response.text(); }
  /** Reads and parses the response body as JSON. */
  json() { return this.#response.json(); }
  /** Reads the response body as an `ArrayBuffer`. */
  arrayBuffer() { return this.#response.arrayBuffer(); }
  /** Reads the response body as bytes. */
  bytes() { return this.#response.bytes(); }
  /** Reads the response body as a `Blob`. */
  blob() { return this.#response.blob(); }
  /** Reads the response body as `FormData`. */
  formData() { return this.#response.formData(); }

  /**
   * Values produced by the endpoint's response modifiers.
   * Their keys match modifier tags such as `body` and `headers`.
   */
  get valid() {
    return this.#valid as Endpoint.InferValidParams<E>;
  }

  get params(): Endpoint.InferCallParams<E> {
    return this.#params;
  }
}
