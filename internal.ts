/**
 * Low-level APIs used to build adapters and endpoint modifiers.
 * These exports may change more often than the package's main API.
 */
export { Adapter } from "./src/adapter";
export { Endpoint, type CheckUniqueKeys } from "./src/endpoint";
export { ContractRequest, type RequestParams } from "./src/contract-request";
export { ContractResponse } from "./src/contract-response";

export {
  NO_MODIFIER_ARGS,
  createRequestModifier,
  createResponseModifier,
  type AnyEndpointModifier,
  type AnyRequestModifier,
  type BaseRequestModifier,
  type BaseResponseModifier,
  type EndpointModifier
} from "./src/endpoint-modifier";

export {
  applyHeaderPatch,
  defaultSerializeValue,
  resolvePrimitive,
  resolvePrimitiveRecord,
  type BodyReaderOutput,
  type Flatten,
  type HeaderPatch,
  type OptionalizeEmpties,
  type RemoveEmpties,
  type RemoveNevers,
  type UnionToIntersection
} from "./src/common";

export { headersToRecord } from "./src/endpoint-modifiers/response-headers";
