/** Public APIs for defining and calling typed HTTP endpoints. */
export { APIConnector } from "./src/api";
export { OpenAIJSONSchemaAdapter } from "./src/openai-json-schema";

export { method, type Method } from "./src/endpoint-modifiers/method";
export { path, type PathModifier } from "./src/endpoint-modifiers/path";
export { query } from "./src/endpoint-modifiers/query";
export { requestBody } from "./src/endpoint-modifiers/request-body";
export { requestHeaders } from "./src/endpoint-modifiers/request-headers";
export { responseBody } from "./src/endpoint-modifiers/response-body";
export { responseHeaders } from "./src/endpoint-modifiers/response-headers";

export type {
  ArrayOr,
  BodyReader,
  FetchLike,
  GetterOr,
  JSONPrimitive,
  JSONValue,
  PromiseOr,
  Schema,
  URLSafeValue
} from "./src/common";
