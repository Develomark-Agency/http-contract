import type { Op as ProdkitOp } from "@prodkit/op";
import type { Result as BetterResult } from "better-result";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type { BuiltInBodyError, BuiltInRequestError } from "./errors";

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

type BodyReader<Output, Errors, Mode extends ResponseMode> =
  Mode extends "op" ? ProdkitOp<Output, Errors | BuiltInBodyError, []> :
  Mode extends "result" ? Promise<BetterResult<Output, Errors | BuiltInBodyError>> :
  Promise<Output>;

export type TypedResponse<Output, Errors, Mode extends ResponseMode = "throw"> =
  Omit<Response, "json" | "text" | "blob" | "arrayBuffer" | "formData" | "clone"> & {
    json(): BodyReader<Output, Errors, Mode>;
    text(): BodyReader<Output, Errors, Mode>;
    blob(): BodyReader<Output, Errors, Mode>;
    arrayBuffer(): BodyReader<Output, Errors, Mode>;
    formData(): BodyReader<Output, Errors, Mode>;
    clone(): TypedResponse<Output, Errors, Mode>;
  };

export type EndpointConfig = {
  methodSet: boolean;
  path: unknown;
  pathOutput: unknown;
  query: unknown;
  queryOutput: unknown;
  body: unknown;
  headers: unknown;
  output: unknown;
  errors: unknown;
};

type Amend<Config extends EndpointConfig, Key extends keyof EndpointConfig, Value> =
  Omit<Config, Key> & Record<Key, Value>;
type AmendPath<Config extends EndpointConfig, S extends StandardSchema> =
  Omit<Config, "path" | "pathOutput"> & {
    path: StandardSchema.InferInput<S>;
    pathOutput: StandardSchema.InferOutput<S>;
  };
type AmendQuery<Config extends EndpointConfig, S extends StandardSchema> =
  Omit<Config, "query" | "queryOutput"> & {
    query: StandardSchema.InferInput<S>;
    queryOutput: StandardSchema.InferOutput<S>;
  };
type SchemaWithOutputArgs<S extends StandardSchema, Output> =
  StandardSchema.InferOutput<S> extends Output ? [schema: S] : [schema: never];

type UrlParameters<Path = never, Query = never> =
  object extends CallArgs<Path, Query, never, never>
    ? [args?: CallArgs<Path, Query, never, never>]
    : [args: CallArgs<Path, Query, never, never>];

export type Endpoint<Template extends string, PathKeys extends string, Config extends EndpointConfig> = {
  (...args: CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>): Promise<TypedResponse<Config["output"], Config["errors"], "throw">>;
  result: {
    (...args: CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>): Promise<BetterResult<TypedResponse<Config["output"], Config["errors"], "result">, Config["errors"] | BuiltInRequestError>>;
    url(args: CallArgs<Config["path"], Config["query"], never, never>): Promise<BetterResult<URL, BuiltInRequestError>>;
  };
  op: ProdkitOp<TypedResponse<Config["output"], Config["errors"], "op">, Config["errors"] | BuiltInRequestError, CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>> & {
    url: ProdkitOp<URL, BuiltInRequestError, UrlParameters<Config["path"], Config["query"]>>;
  };
  url(args: CallArgs<Config["path"], Config["query"], never, never>): Promise<URL>;
  method<M extends HttpMethod>(method: M): Endpoint<Template, PathKeys, Amend<Config, "methodSet", true>>;
  path: [PathKeys] extends [never]
    ? never
    : <S extends StandardSchema>(...args: SchemaWithOutputArgs<S, PathSchemaOutput<PathKeys>>) => Endpoint<Template, PathKeys, AmendPath<Config, S>>;
  query<S extends StandardSchema>(...args: SchemaWithOutputArgs<S, SerializableParamRecord>): Endpoint<Template, PathKeys, AmendQuery<Config, S>>;
  requestHeaders<S extends StandardSchema>(...args: SchemaWithOutputArgs<S, SerializableParamRecord>): Endpoint<Template, PathKeys, Amend<Config, "headers", StandardSchema.InferInput<S>>>;
  responseHeaders<S extends StandardSchema<SerializableParamRecord, unknown>>(schema: S): Endpoint<Template, PathKeys, Config>;
  body<S extends StandardSchema>(schema: S, options?: BodyOptions): Endpoint<Template, PathKeys, Amend<Config, "body", StandardSchema.InferInput<S>>>;
  output<S extends StandardSchema>(schema: S): Endpoint<Template, PathKeys, Amend<Config, "output", StandardSchema.InferOutput<S>>>;
  validate<F extends (ctx: Omit<RuntimeContext, "path" | "query" | "headers"> & {
    path: [Config["pathOutput"]] extends [never] ? Record<string, PathParamValue> : Config["pathOutput"];
    query: [Config["queryOutput"]] extends [never] ? QueryInput : Config["queryOutput"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Amend<Config, "errors", Config["errors"] | ValidateError<ReturnType<F>>>>;
  transform<F extends (ctx: Omit<RuntimeContext, "path" | "query" | "headers"> & {
    path: [Config["pathOutput"]] extends [never] ? Record<string, PathParamValue> : Config["pathOutput"];
    query: [Config["queryOutput"]] extends [never] ? QueryInput : Config["queryOutput"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
    value: Config["output"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Omit<Config, "output" | "errors"> & {
    output: TransformOk<ReturnType<F>, Config["output"]>;
    errors: Config["errors"] | TransformError<ReturnType<F>>;
  }>;
};
