import type { Endpoint } from "./endpoint";

export class ContractResponse<E extends Endpoint<any>> implements Response {
  #response;
  #valid;

  private constructor(
    private endpoint: E,
    response: Response,
    valid: Endpoint.InferValidParams<E>
  ) {
    this.#response = response;
    this.#valid = valid;
  }

  static from<E extends Endpoint<any>>(
    endpoint: E,
    response: Response,
    valid: Endpoint.InferValidParams<E>
  ) {
    return new ContractResponse(endpoint, response, valid);
  }

  get ok() { return this.#response.ok }
  get status() { return this.#response.status }
  get statusText() { return this.#response.statusText }
  get url() { return this.#response.url }
  get headers() { return this.#response.headers }
  get type() { return this.#response.type }
  get bodyUsed() { return this.#response.bodyUsed }
  get body() { return this.#response.body }
  get redirected() { return this.#response.redirected }
  clone() { return this.#response.clone() }
  text() { return this.#response.text() }
  json() { return this.#response.json() }
  arrayBuffer() { return this.#response.arrayBuffer() }
  bytes() { return this.#response.bytes() }
  blob() { return this.#response.blob() }
  formData() { return this.#response.formData() }

  get valid() {
    return this.#valid as Endpoint.InferValidParams<E>;
  }
}