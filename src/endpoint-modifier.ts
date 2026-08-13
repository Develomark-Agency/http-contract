import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { HeaderPatch, PromiseOr } from "./common";
import type { Err, InferErr, InferOk, Ok } from "better-result";

export declare const callContribution: unique symbol;
export declare const validContribution: unique symbol;

export const NO_MODIFIER_ARGS = Symbol("@http-contract/no-modifier-args");

export namespace EndpointModifier {
  export type Side = "request" | "response";
  export type ExtractCall<Modifier> = Modifier extends EndpointModifier<any, any, infer C, any, any, any> ? C : never;
  export type ExtractValid<Modifier> = Modifier extends EndpointModifier<any, any, any, infer V, any, any> ? V : never;
  export type ExtractRequestError<Modifier> = Modifier extends EndpointModifier<any, any, any, any, infer E, any> ? E : never;
  export type ExtractResponseError<Modifier> = Modifier extends EndpointModifier<any, any, any, any, any, infer E> ? E : never;
}

interface ModifiedRequest {
  url?: URL,
  init?: Omit<RequestInit, "headers"> & { headers?: never },
  headers?: HeaderPatch
}

interface BaseError { source: string }

type ModifiedRequestResult<E extends BaseError> = void | Ok<ModifiedRequest, never> | Err<never, E>;
type ModifiedResponseResult<Valid, E extends BaseError> = void | Ok<Valid, never> | Err<never, E>;

export type AnyEndpointModifier = EndpointModifier<EndpointModifier.Side, string, any, any, BaseError, BaseError>;
export type AnyRequestModifier = BaseRequestModifier<string, any, BaseError>;

export interface EndpointModifier<
  Side extends EndpointModifier.Side,
  Tag extends string,
  Call,
  Valid,
  RequestError extends BaseError,
  ResponseError extends BaseError
> {
  readonly side: Side,
  readonly tag: Tag,

  readonly [callContribution]: Call,
  readonly [validContribution]: Valid,

  modifyRequest(args: Call | typeof NO_MODIFIER_ARGS, url: URL, init: RequestInit): PromiseOr<ModifiedRequestResult<RequestError>>,
  modifyResponse(res: Response): PromiseOr<ModifiedResponseResult<Valid, ResponseError>>
}

export interface BaseRequestModifier<Tag extends string, Call, E extends BaseError> extends EndpointModifier<"request", Tag, Call, never, E, never> {
  readonly jsonSchema?: {
    readonly required: boolean,
    readonly value: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>
  }
}
export interface BaseResponseModifier<Tag extends string, Valid, E extends BaseError> extends EndpointModifier<"response", Tag, never, Valid, never, E> {}

export function createRequestModifier<Tag extends string>(tag: Tag) {
  return function <Call>() {
    return function requestModifier<Output extends PromiseOr<ModifiedRequestResult<BaseError>>>(
      modifyRequest: (
        args: Call | typeof NO_MODIFIER_ARGS,
        url: URL,
        init: RequestInit
      ) => Output,
      jsonSchema?: BaseRequestModifier<Tag, Call, BaseError>["jsonSchema"]
    ) {
      type E = InferErr<Exclude<Awaited<Output>, void>>;

      type RequestModifier<Tag extends string> = BaseRequestModifier<Tag, Call, E>;

      return {
        tag,
        side: "request",
        modifyRequest: modifyRequest as RequestModifier<Tag>["modifyRequest"],
        modifyResponse(_res) {},
        jsonSchema
      } as RequestModifier<Tag>;
    };
  };
}

export function createResponseModifier<Tag extends string>(tag: Tag) {
  return function responseModifier<Output extends PromiseOr<ModifiedResponseResult<unknown, BaseError>>>(
    modifyResponse: (res: Response) => Output
  ) {
    type ResultOutput = Exclude<Awaited<Output>, void>;
    type ResponseModifier<Tag extends string> = BaseResponseModifier<Tag, InferOk<ResultOutput>, InferErr<ResultOutput>>;

    return {
      tag,
      side: "response",
      modifyRequest(_args: typeof NO_MODIFIER_ARGS, _url: URL, _init: RequestInit) {},
      modifyResponse: modifyResponse as ResponseModifier<Tag>["modifyResponse"]
    } as ResponseModifier<Tag>;
  };
}
