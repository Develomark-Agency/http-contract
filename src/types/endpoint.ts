import type { Op as ProdkitOp } from "@prodkit/op";
import type { Result as BetterResult } from "better-result";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type { BuiltInRequestError } from "../errors.js";
import type {
  BodyOptions,
  CallArgs,
  CallParameters,
  HeadersInput,
  HttpMethod,
  PathParamValue,
  PathSchemaOutput,
  QueryInput,
  RuntimeContext,
  SerializableParamRecord,
  ValidateError,
  ValidateReturn,
  TransformOk,
  TransformError,
} from "./common.js";
import type { TypedResponse } from "./response.js";

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
