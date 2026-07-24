import type { Result as BetterResult } from "better-result";
import type { StandardSchemaV1, StandardJSONSchemaV1 } from "@standard-schema/spec";
export type StandardSchema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output>;

export type CommonHttpMethod = "get" | "post" | "put" | "patch" | "delete";
export type HttpMethod = CommonHttpMethod | (string & {});
export type PathParamValue = string | number | boolean | bigint | Date;
export type QueryValue = PathParamValue | PathParamValue[] | undefined;
export type HeadersInput = Record<string, string>;
export type SerializableParamRecord = Record<string, QueryValue>;
export type QueryInput = Record<string, QueryValue>;
export type MaybePromise<T> = T | Promise<T>;
export type ValueFactory<T> = T | (() => MaybePromise<T>);
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type ResponseMode = "throw" | "result" | "op";
export type OutputReaderName = "json" | "text" | "blob" | "arrayBuffer" | "formData";
export type OutputReader = OutputReaderName | ((response: Response) => MaybePromise<unknown>);

export type BodyKind = "json" | "form-data" | "url-encoded" | "binary" | "text";
export type BodySerializer = {
  contentType?: string;
  serialize: (value: unknown) => unknown;
};
export type BodyOptions = {
  kind?: BodyKind;
  serialize?: (value: unknown) => unknown;
  contentType?: string;
};

export type PathParamNames<Template extends string> =
  Template extends `${string}{${infer Param}}${infer Rest}` ? Param | PathParamNames<Rest> : never;
export type DefaultPathParams<Template extends string> =
  [PathParamNames<Template>] extends [never]
    ? never
    : { [Key in PathParamNames<Template>]: PathParamValue };
export type PathSchemaOutput<Keys extends string> = {
  [Key in Keys]: PathParamValue;
};

export type OnRequestContext = {
  url: URL;
  init: RequestInit;
};

export type OnResponseContext = {
  res: Response;
  url: URL;
  init: RequestInit;
};

export type ApiOptions = {
  baseUrl: ValueFactory<string>;
  fetch?: FetchLike;
  headers?: Record<string, ValueFactory<string>>;
  query?: Record<string, ValueFactory<QueryValue>>;
  onRequest?: Array<(ctx: OnRequestContext) => MaybePromise<void | BetterResult<never, unknown>>>;
  onResponse?: Array<(ctx: OnResponseContext) => MaybePromise<void | BetterResult<never, unknown>>>;
};

export type EndpointState = {
  api: ApiOptions;
  template: string;
  method: HttpMethod;
  methodSet: boolean;
  pathSchema?: StandardSchema;
  querySchema?: StandardSchema;
  requestHeadersSchema?: StandardSchema;
  responseHeadersSchema?: StandardSchema;
  bodySchema?: StandardSchema;
  bodySerializer?: BodySerializer;
  outputSchema?: StandardSchema;
  outputReader: OutputReader;
  validate?: (ctx: RuntimeContext) => unknown;
  transform?: (ctx: RuntimeContext & { value: unknown }) => unknown;
};

export type RuntimeContext = {
  res: Response;
  path: Record<string, PathParamValue>;
  query: QueryInput;
  headers: HeadersInput;
  method: string;
  url: URL;
};

type RequiredKeys<T> = T extends object
  ? {
      [Key in keyof T]-?: object extends Pick<T, Key> ? never : Key;
    }[keyof T]
  : keyof T;
type IsAllOptionalObject<T> = T extends object ? [RequiredKeys<T>] extends [never] ? true : false : false;
type InputPart<Key extends string, Value> =
  [Value] extends [never] ? object :
  IsAllOptionalObject<Value> extends true ? { [K in Key]?: Value } : { [K in Key]: Value };

export type CallArgs<Path = never, Query = never, Body = never, Headers = never> =
  InputPart<"path", Path> &
  InputPart<"query", Query> &
  InputPart<"body", Body> &
  InputPart<"headers", Headers>;

type CallRequestOptions<MethodSet extends boolean> =
  Omit<RequestInit, "body" | "headers" | "method"> &
  (MethodSet extends true ? { method?: never } : { method?: HttpMethod });

export type EndpointCallArgs<MethodSet extends boolean, Path = never, Query = never, Body = never, Headers = never> =
  CallArgs<Path, Query, Body, Headers> & CallRequestOptions<MethodSet>;

export type CallParameters<MethodSet extends boolean, Path = never, Query = never, Body = never, Headers = never> =
  object extends CallArgs<Path, Query, Body, Headers>
    ? [args?: EndpointCallArgs<MethodSet, Path, Query, Body, Headers>]
    : [args: EndpointCallArgs<MethodSet, Path, Query, Body, Headers>];

export type ValidateReturn = void | undefined | BetterResult<unknown, unknown> | Error | unknown;
export type ValidateError<T> =
  T extends BetterResult<unknown, infer E> ? E :
  Exclude<T, void | undefined>;
export type TransformOk<T, Fallback> =
  T extends BetterResult<infer Ok, unknown> ? Ok :
  [Exclude<T, void | undefined>] extends [never] ? Fallback : Exclude<T, void | undefined>;
export type TransformError<T> = T extends BetterResult<unknown, infer E> ? E : never;
