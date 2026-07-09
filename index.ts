import type { Result as BetterResult } from "better-result";
import { createEndpoint } from "./src/endpoint";
import type { ApiOptions, DefaultPathParams, Endpoint, PathParamNames } from "./types";

// Error classes (runtime)
export {
  HttpContractFetchError,
  HttpContractAbortError,
  HttpContractRequestBuildError,
  HttpContractSchemaError,
  HttpContractJsonParseError,
  HttpContractBodyReadError,
} from "./errors";

// Error types
export type {
  BuiltInRequestError,
  BuiltInBodyError,
} from "./errors";

// All types from types.ts
export type {
  CommonHttpMethod,
  HttpMethod,
  PathParamValue,
  QueryValue,
  HeadersInput,
  SerializableParamRecord,
  QueryInput,
  MaybePromise,
  ValueFactory,
  FetchLike,
  ResponseMode,
  BodyKind,
  BodySerializer,
  BodyOptions,
  PathParamNames,
  DefaultPathParams,
  PathSchemaOutput,
  OnRequestContext,
  OnResponseContext,
  ApiOptions,
  EndpointState,
  RuntimeContext,
  CallArgs,
  EndpointCallArgs,
  CallParameters,
  ValidateReturn,
  ValidateError,
  TransformOk,
  TransformError,
  TypedResponse,
  EndpointConfig,
  Endpoint,
} from "./types";

export function defineApi<const T extends ApiOptions>(options: T) {
  type OnRequestErrors = ExtractHookErrors<T["onRequest"]>;
  type OnResponseErrors = ExtractHookErrors<T["onResponse"]>;
  type HookErrors = OnRequestErrors | OnResponseErrors;

  return {
    endpoint<const Template extends string>(template: Template) {
      return createEndpoint({
        api: options as ApiOptions,
        template,
        method: "get",
        methodSet: false
      }) as unknown as Endpoint<Template, PathParamNames<Template>, {
        methodSet: false;
        path: DefaultPathParams<Template>;
        pathOutput: DefaultPathParams<Template>;
        query: never;
        queryOutput: never;
        body: never;
        headers: never;
        output: unknown;
        errors: HookErrors;
      }>;
    }
  };
}
export default defineApi;

type ExtractHookErrors<T> =
  T extends readonly unknown[]
    ? { [K in keyof T]: T[K] extends (...args: any[]) => infer R ? ExtractReturnError<R> : never }[number]
    : never;

type ExtractReturnError<R> =
  R extends BetterResult<never, infer E> ? E :
  R extends Promise<infer P> ? ExtractReturnError<P> :
  never;
