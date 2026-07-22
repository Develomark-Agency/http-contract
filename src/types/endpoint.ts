import type { Op as ProdkitOp } from "@prodkit/op";
import type { Result as BetterResult } from "better-result";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type { BuiltInRequestError } from "../errors";
import type {
  BodyOptions,
  CallArgs,
  CallParameters,
  HeadersInput,
  HttpMethod,
  PathParamValue,
  PathSchemaOutput,
  QueryInput,
  OutputReader,
  RuntimeContext,
  SerializableParamRecord,
  ValidateError,
  ValidateReturn,
  TransformOk,
  TransformError,
} from "./common";
import type { TypedResponse } from "./response";

export type EndpointConfig = {
  methodSet: boolean;
  path: unknown;
  pathOutput: unknown;
  query: unknown;
  queryOutput: unknown;
  body: unknown;
  headers: unknown;
  output: unknown;
  readOutput: unknown;
  errors: unknown;
  pathSchema: StandardSchema | undefined;
  querySchema: StandardSchema | undefined;
  requestHeadersSchema: StandardSchema | undefined;
  responseHeadersSchema: StandardSchema | undefined;
  bodySchema: StandardSchema | undefined;
  outputSchema: StandardSchema | undefined;
  validate: ((ctx: any) => unknown) | undefined;
  transform: ((ctx: any) => unknown) | undefined;
};

/** Infers the path parameters accepted by an endpoint. */
export type InferEndpointPath<T> =
  T extends Endpoint<any, any, infer Config> ? Config["path"] : never;

/** Infers the query parameters accepted by an endpoint. */
export type InferEndpointQuery<T> =
  T extends Endpoint<any, any, infer Config> ? Config["query"] : never;

/** Infers the request body accepted by an endpoint. */
export type InferEndpointBody<T> =
  T extends Endpoint<any, any, infer Config> ? Config["body"] : never;

/** Infers the request headers accepted by an endpoint. */
export type InferEndpointHeaders<T> =
  T extends Endpoint<any, any, infer Config> ? Config["headers"] : never;

/** Infers the output value produced by an endpoint's output schema. */
export type InferEndpointOutput<T> =
  T extends Endpoint<any, any, infer Config> ? Config["output"] : never;

type Amend<Config extends EndpointConfig, Key extends keyof EndpointConfig, Value> =
  Omit<Config, Key> & Record<Key, Value>;
type AmendPath<Config extends EndpointConfig, S extends StandardSchema> =
  Omit<Config, "path" | "pathOutput" | "pathSchema"> & {
    path: StandardSchema.InferInput<S>;
    pathOutput: StandardSchema.InferOutput<S>;
    pathSchema: S;
  };
type AmendQuery<Config extends EndpointConfig, S extends StandardSchema> =
  Omit<Config, "query" | "queryOutput" | "querySchema"> & {
    query: StandardSchema.InferInput<S>;
    queryOutput: StandardSchema.InferOutput<S>;
    querySchema: S;
  };
type AmendOutput<Config extends EndpointConfig, S extends StandardSchema> =
  Omit<Config, "output" | "readOutput" | "outputSchema"> & {
    output: StandardSchema.InferOutput<S>;
    readOutput: StandardSchema.InferOutput<S>;
    outputSchema: S;
  };
type SchemaWithOutputArgs<S extends StandardSchema, Output> =
  StandardSchema.InferOutput<S> extends Output ? [schema: S] : [schema: never];

type UrlParameters<Path = never, Query = never> =
  object extends CallArgs<Path, Query, never, never>
    ? [args?: CallArgs<Path, Query, never, never>]
    : [args: CallArgs<Path, Query, never, never>];

export type Endpoint<Template extends string, PathKeys extends string, Config extends EndpointConfig> = {
  (...args: CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>): Promise<TypedResponse<Config["output"], Config["errors"], "throw", Config["readOutput"]>>;
  result: {
    (...args: CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>): Promise<BetterResult<TypedResponse<Config["output"], Config["errors"], "result", Config["readOutput"]>, Config["errors"] | BuiltInRequestError>>;
    url(args: CallArgs<Config["path"], Config["query"], never, never>): Promise<BetterResult<URL, BuiltInRequestError>>;
  };
  op: ProdkitOp<TypedResponse<Config["output"], Config["errors"], "op", Config["readOutput"]>, Config["errors"] | BuiltInRequestError, CallParameters<Config["methodSet"], Config["path"], Config["query"], Config["body"], Config["headers"]>> & {
    url: ProdkitOp<URL, BuiltInRequestError, UrlParameters<Config["path"], Config["query"]>>;
  };
  url(args: CallArgs<Config["path"], Config["query"], never, never>): Promise<URL>;
  readonly config: {
    readonly pathSchema: Config["pathSchema"];
    readonly querySchema: Config["querySchema"];
    readonly requestHeadersSchema: Config["requestHeadersSchema"];
    readonly responseHeadersSchema: Config["responseHeadersSchema"];
    readonly bodySchema: Config["bodySchema"];
    readonly outputSchema: Config["outputSchema"];
    readonly validate: Config["validate"];
    readonly transform: Config["transform"];
  };
  method<M extends HttpMethod>(method: M): Endpoint<Template, PathKeys, Amend<Config, "methodSet", true>>;
  path: [PathKeys] extends [never]
    ? never
    : <S extends StandardSchema>(...args: SchemaWithOutputArgs<S, PathSchemaOutput<PathKeys>>) => Endpoint<Template, PathKeys, AmendPath<Config, S>>;
  query<S extends StandardSchema>(...args: SchemaWithOutputArgs<S, SerializableParamRecord>): Endpoint<Template, PathKeys, AmendQuery<Config, S>>;
  requestHeaders<S extends StandardSchema>(...args: SchemaWithOutputArgs<S, SerializableParamRecord>): Endpoint<Template, PathKeys, Amend<Amend<Config, "headers", StandardSchema.InferInput<S>>, "requestHeadersSchema", S>>;
  responseHeaders<S extends StandardSchema<SerializableParamRecord, unknown>>(schema: S): Endpoint<Template, PathKeys, Amend<Config, "responseHeadersSchema", S>>;
  body<S extends StandardSchema>(schema: S, options?: BodyOptions): Endpoint<Template, PathKeys, Amend<Amend<Config, "body", StandardSchema.InferInput<S>>, "bodySchema", S>>;
  output<S extends StandardSchema>(schema: S, reader?: OutputReader): Endpoint<Template, PathKeys, AmendOutput<Config, S>>;
  validate<F extends (ctx: Omit<RuntimeContext, "path" | "query" | "headers"> & {
    path: [Config["pathOutput"]] extends [never] ? Record<string, PathParamValue> : Config["pathOutput"];
    query: [Config["queryOutput"]] extends [never] ? QueryInput : Config["queryOutput"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Amend<Amend<Config, "errors", Config["errors"] | ValidateError<ReturnType<F>>>, "validate", F>>;
  transform<F extends (ctx: Omit<RuntimeContext, "path" | "query" | "headers"> & {
    path: [Config["pathOutput"]] extends [never] ? Record<string, PathParamValue> : Config["pathOutput"];
    query: [Config["queryOutput"]] extends [never] ? QueryInput : Config["queryOutput"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
    value: Config["output"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Omit<Config, "output" | "readOutput" | "errors" | "transform"> & {
    output: TransformOk<ReturnType<F>, Config["output"]>;
    readOutput: TransformOk<ReturnType<F>, Config["readOutput"]>;
    errors: Config["errors"] | TransformError<ReturnType<F>>;
    transform: F;
  }>;
};
