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
  SchemaOutput,
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
  query: unknown;
  body: unknown;
  headers: unknown;
  output: unknown;
  errors: unknown;
};

type Amend<Config extends EndpointConfig, Key extends keyof EndpointConfig, Value> =
  Omit<Config, Key> & Record<Key, Value>;

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
    : <S extends StandardSchema<unknown, PathSchemaOutput<PathKeys>>>(schema: S) => Endpoint<Template, PathKeys, Amend<Config, "path", SchemaOutput<S>>>;
  query<S extends StandardSchema>(schema: S): Endpoint<Template, PathKeys, Amend<Config, "query", SchemaOutput<S>>>;
  requestHeaders<S extends StandardSchema<unknown, SerializableParamRecord>>(schema: S): Endpoint<Template, PathKeys, Amend<Config, "headers", SchemaOutput<S>>>;
  responseHeaders<S extends StandardSchema<SerializableParamRecord, unknown>>(schema: S): Endpoint<Template, PathKeys, Config>;
  body<S extends StandardSchema>(schema: S, options?: BodyOptions): Endpoint<Template, PathKeys, Amend<Config, "body", SchemaOutput<S>>>;
  output<S extends StandardSchema>(schema: S): Endpoint<Template, PathKeys, Amend<Config, "output", SchemaOutput<S>>>;
  validate<F extends (ctx: RuntimeContext & {
    path: [Config["path"]] extends [never] ? Record<string, PathParamValue> : Config["path"];
    query: [Config["query"]] extends [never] ? QueryInput : Config["query"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Amend<Config, "errors", Config["errors"] | ValidateError<ReturnType<F>>>>;
  transform<F extends (ctx: RuntimeContext & {
    path: [Config["path"]] extends [never] ? Record<string, PathParamValue> : Config["path"];
    query: [Config["query"]] extends [never] ? QueryInput : Config["query"];
    headers: [Config["headers"]] extends [never] ? HeadersInput : Config["headers"];
    value: Config["output"];
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Omit<Config, "output" | "errors"> & {
    output: TransformOk<ReturnType<F>, Config["output"]>;
    errors: Config["errors"] | TransformError<ReturnType<F>>;
  }>;
};
