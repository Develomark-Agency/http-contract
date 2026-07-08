import { Op, type Op as ProdkitOp } from "@prodkit/op";
import { Result, TaggedError, type Result as BetterResult } from "better-result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type AnySchema<Input = unknown, Output = unknown> = StandardSchemaV1<Input, Output>;
type SchemaOutput<T> = T extends StandardSchemaV1<unknown, infer Output> ? Output : never;
type CommonHttpMethod = "get" | "post" | "put" | "patch" | "delete";
type HttpMethod = CommonHttpMethod | (string & {});
type PathParamValue = string | number | boolean | bigint | Date;
type QueryValue = PathParamValue | PathParamValue[] | undefined;
type HeadersInput = Record<string, string>;
type QueryInput = Record<string, QueryValue>;
type MaybePromise<T> = T | Promise<T>;
type ValueFactory<T> = T | (() => MaybePromise<T>);
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ResponseMode = "throw" | "result" | "op";
type PathParamNames<Template extends string> =
  Template extends `${string}{${infer Param}}${infer Rest}` ? Param | PathParamNames<Rest> : never;
type DefaultPathParams<Template extends string> =
  [PathParamNames<Template>] extends [never]
    ? never
    : { [Key in PathParamNames<Template>]: PathParamValue };
type PathSchemaOutput<Keys extends string> = {
  [Key in Keys]: PathParamValue;
};
type BuiltInRequestError =
  | HttpContractRequestBuildError
  | HttpContractFetchError
  | HttpContractAbortError
  | HttpContractSchemaError;
type BuiltInBodyError = HttpContractJsonParseError | HttpContractBodyReadError | HttpContractAbortError | HttpContractSchemaError;

type ApiOptions = {
  baseUrl: string;
  fetch?: FetchLike;
  headers?: Record<string, ValueFactory<string>>;
  query?: Record<string, ValueFactory<QueryValue>>;
};

type EndpointState = {
  api: ApiOptions;
  template: string;
  method: HttpMethod;
  pathSchema?: AnySchema;
  querySchema?: AnySchema;
  requestHeadersSchema?: AnySchema;
  bodySchema?: AnySchema;
  outputSchema?: AnySchema;
  validate?: (ctx: RuntimeContext) => unknown;
  transform?: (ctx: RuntimeContext & { value: unknown }) => unknown;
};

type RuntimeContext = {
  res: Response;
  path: Record<string, PathParamValue>;
  query: QueryInput;
  headers: HeadersInput;
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
type CallArgs<Path = never, Query = never, Body = never, Headers = never> =
  InputPart<"path", Path> &
  InputPart<"query", Query> &
  InputPart<"body", Body> &
  InputPart<"headers", Headers>;
type CallParameters<Path = never, Query = never, Body = never, Headers = never> =
  object extends CallArgs<Path, Query, Body, Headers>
    ? [args?: CallArgs<Path, Query, Body, Headers>]
    : [args: CallArgs<Path, Query, Body, Headers>];

type ValidateReturn = void | undefined | BetterResult<unknown, unknown> | Error | unknown;
type ValidateError<T> =
  T extends BetterResult<unknown, infer E> ? E :
  Exclude<T, void | undefined>;
type TransformOk<T, Fallback> =
  T extends BetterResult<infer Ok, unknown> ? Ok :
  [Exclude<T, void | undefined>] extends [never] ? Fallback : Exclude<T, void | undefined>;
type TransformError<T> = T extends BetterResult<unknown, infer E> ? E : never;

type Endpoint<Template extends string, PathKeys extends string, Path, Query, Body, Headers, Output, Errors> = {
  (...args: CallParameters<Path, Query, Body, Headers>): Promise<TypedResponse<Output, Errors, "throw">>;
  result(...args: CallParameters<Path, Query, Body, Headers>): Promise<BetterResult<TypedResponse<Output, Errors, "result">, Errors | BuiltInRequestError>>;
  op(...args: CallParameters<Path, Query, Body, Headers>): ProdkitOp<TypedResponse<Output, Errors, "op">, Errors | BuiltInRequestError, []>;
  method<M extends HttpMethod>(method: M): Endpoint<Template, PathKeys, Path, Query, Body, Headers, Output, Errors>;
  path: [PathKeys] extends [never]
    ? never
    : <S extends AnySchema<unknown, PathSchemaOutput<PathKeys>>>(schema: S) => Endpoint<Template, PathKeys, SchemaOutput<S>, Query, Body, Headers, Output, Errors>;
  query<S extends AnySchema>(schema: S): Endpoint<Template, PathKeys, Path, SchemaOutput<S>, Body, Headers, Output, Errors>;
  requestHeaders<S extends AnySchema>(schema: S): Endpoint<Template, PathKeys, Path, Query, Body, SchemaOutput<S>, Output, Errors>;
  body<S extends AnySchema>(schema: S): Endpoint<Template, PathKeys, Path, Query, SchemaOutput<S>, Headers, Output, Errors>;
  output<S extends AnySchema>(schema: S): Endpoint<Template, PathKeys, Path, Query, Body, Headers, SchemaOutput<S>, Errors>;
  validate<F extends (ctx: RuntimeContext & {
    path: [Path] extends [never] ? Record<string, PathParamValue> : Path;
    query: [Query] extends [never] ? QueryInput : Query;
    headers: [Headers] extends [never] ? HeadersInput : Headers;
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Path, Query, Body, Headers, Output, Errors | ValidateError<ReturnType<F>>>;
  transform<F extends (ctx: RuntimeContext & {
    path: [Path] extends [never] ? Record<string, PathParamValue> : Path;
    query: [Query] extends [never] ? QueryInput : Query;
    headers: [Headers] extends [never] ? HeadersInput : Headers;
    value: Output;
  }) => ValidateReturn>(fn: F): Endpoint<Template, PathKeys, Path, Query, Body, Headers, TransformOk<ReturnType<F>, Output>, Errors | TransformError<ReturnType<F>>>;
};

export class HttpContractFetchError extends TaggedError("HttpContractFetchError")<{
  cause: unknown;
}>() {}

export class HttpContractAbortError extends TaggedError("HttpContractAbortError")<{
  cause: unknown;
}>() {}

export class HttpContractRequestBuildError extends TaggedError("HttpContractRequestBuildError")<{
  cause: unknown;
}>() {}

export class HttpContractSchemaError extends TaggedError("HttpContractSchemaError")<{
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>() {}

export class HttpContractJsonParseError extends TaggedError("HttpContractJsonParseError")<{
  cause: unknown;
}>() {}

export class HttpContractBodyReadError extends TaggedError("HttpContractBodyReadError")<{
  cause: unknown;
}>() {}

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

export function defineApi(options: ApiOptions) {
  return {
    endpoint<const Template extends string>(template: Template) {
      return createEndpoint({
        api: options,
        template,
        method: "get"
      }) as unknown as Endpoint<Template, PathParamNames<Template>, DefaultPathParams<Template>, never, never, never, unknown, never>;
    }
  };
}

function createEndpoint(state: EndpointState) {
  const call = (async (args: Record<string, unknown> = {}) => {
    const result = await execute(state, args, "throw");
    if (result.isErr()) throw result.error;
    return result.value;
  }) as any;

  call.result = (args: Record<string, unknown> = {}) => execute(state, args, "result") as unknown as Promise<BetterResult<TypedResponse<unknown, unknown, "result">, unknown>>;
  call.op = (args: Record<string, unknown> = {}) => Op.try(async () => {
    const result = await execute(state, args, "op");
    if (result.isErr()) throw result.error;
    return result.value as unknown as TypedResponse<unknown, unknown, "op">;
  }, error => error);

  call.method = (method: HttpMethod) => createEndpoint({ ...state, method });
  call.path = (schema: AnySchema) => {
    if (!hasPathParams(state.template)) {
      throw new Error(`Cannot define path schema for endpoint without path parameters: ${state.template}`);
    }
    return createEndpoint({ ...state, pathSchema: schema });
  };
  call.query = (schema: AnySchema) => createEndpoint({ ...state, querySchema: schema });
  call.requestHeaders = (schema: AnySchema) => createEndpoint({ ...state, requestHeadersSchema: schema });
  call.body = (schema: AnySchema) => createEndpoint({ ...state, bodySchema: schema });
  call.output = (schema: AnySchema) => createEndpoint({ ...state, outputSchema: schema }) as unknown as Endpoint<string, string, unknown, unknown, unknown, unknown, SchemaOutput<typeof schema>, unknown>;
  call.validate = (validate: EndpointState["validate"]) => createEndpoint({ ...state, validate });
  call.transform = (transform: EndpointState["transform"]) => createEndpoint({ ...state, transform }) as any;

  return call;
}

async function execute(state: EndpointState, args: Record<string, unknown>, mode: ResponseMode) {
  const fetchImpl = state.api.fetch ?? globalThis.fetch;
  const path = await validateInput(state.pathSchema, args.path ?? extractDefaultPath(state.template), "path");
  if (path.isErr()) return path;

  const endpointQuery = await validateInput(state.querySchema, args.query ?? {}, "query");
  if (endpointQuery.isErr()) return endpointQuery;

  const endpointHeaders = await validateInput(state.requestHeadersSchema, args.headers ?? {}, "headers");
  if (endpointHeaders.isErr()) return endpointHeaders;

  const body = await validateInput(state.bodySchema, args.body, "body");
  if (body.isErr()) return body;

  let url: URL;
  let headers: HeadersInput;
  let init: RequestInit;
  try {
    url = await buildUrl(state, path.value as Record<string, PathParamValue>, endpointQuery.value as QueryInput);
    headers = await buildHeaders(state, endpointHeaders.value as HeadersInput, state.bodySchema !== undefined);
    init = { method: state.method.toUpperCase(), headers };

    if (state.bodySchema !== undefined) {
      init.body = JSON.stringify(body.value);
    }
  } catch (cause) {
    return Result.err(new HttpContractRequestBuildError({ cause }));
  }

  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (cause) {
    return Result.err(toFetchError(cause));
  }

  const ctx: RuntimeContext = {
    res,
    path: path.value as Record<string, PathParamValue>,
    query: endpointQuery.value as QueryInput,
    headers
  };

  if (state.validate) {
    const validation = normalizeHookResult(await state.validate(ctx));
    if (validation.isErr()) return validation;
  }

  return Result.ok(createTypedResponse(state, res, ctx, mode));
}

function createTypedResponse(state: EndpointState, res: Response, ctx: RuntimeContext, mode: ResponseMode) {
  const wrap = (reader: BodyReaderRuntime) => {
    if (mode === "op") {
      return () => Op.try(async () => {
        const result = await readBodyResult(state, res, ctx, reader);
        if (result.isErr()) throw result.error;
        return result.value;
      }, error => error);
    }

    return async () => finishBodyResult(await readBodyResult(state, res, ctx, reader), mode);
  };

  return new Proxy(res, {
    get(target, prop, receiver) {
      if (prop === "json") return wrap({ kind: "json", read: response => response.json() });
      if (prop === "text") return wrap({ kind: "body", read: response => response.text() });
      if (prop === "blob") return wrap({ kind: "body", read: response => response.blob() });
      if (prop === "arrayBuffer") return wrap({ kind: "body", read: response => response.arrayBuffer() });
      if (prop === "formData") return wrap({ kind: "body", read: response => response.formData() });
      if (prop === "clone") {
        return () => createTypedResponse(state, target.clone() as unknown as Response, ctx, mode);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

type BodyReaderRuntime = {
  kind: "json" | "body";
  read: (response: Response) => Promise<unknown>;
};

async function readBodyResult(state: EndpointState, res: Response, ctx: RuntimeContext, reader: BodyReaderRuntime) {
  const parsed = await Result.tryPromise({
    try: () => reader.read(res.clone() as unknown as Response),
    catch: cause => toBodyError(cause, reader.kind)
  });
  if (parsed.isErr()) return parsed;

  const output = await validateInput(state.outputSchema, parsed.value, "output");
  if (output.isErr()) return output;

  if (state.transform) {
    const transformed = normalizeTransformResult(await state.transform({ ...ctx, value: output.value }), output.value);
    if (transformed.isErr()) return transformed;
    return Result.ok(transformed.value);
  }

  return Result.ok(output.value);
}

function finishBodyResult(result: BetterResult<unknown, unknown>, mode: ResponseMode) {
  if (mode === "result") return result;
  if (result.isErr()) throw result.error;
  return result.value;
}

async function validateInput(schema: AnySchema | undefined, value: unknown, label: string) {
  if (!schema) return Result.ok(value);

  const result = await Result.tryPromise({
    try: () => Promise.resolve(schema["~standard"].validate(value)),
    catch: cause => new HttpContractSchemaError({
      issues: [{ message: `${label}: schema validator threw: ${getErrorMessage(cause)}` }]
    })
  });
  if (result.isErr()) return result;

  const validation = result.value;
  if (validation.issues) {
    return Result.err(new HttpContractSchemaError({
      issues: validation.issues.map(issue => ({
        ...issue,
        message: `${label}: ${issue.message}`
      }))
    }));
  }

  return Result.ok(validation.value);
}

function normalizeHookResult(value: unknown) {
  if (isResult(value)) return value.status === "ok" ? Result.ok(undefined) : Result.err(value.error);
  if (value === undefined) return Result.ok(undefined);
  return Result.err(value);
}

function normalizeTransformResult(value: unknown, fallback: unknown) {
  if (isResult(value)) return value;
  if (value === undefined) return Result.ok(fallback);
  return Result.ok(value);
}

function isResult(value: unknown): value is BetterResult<unknown, unknown> {
  return typeof value === "object" && value !== null && "status" in value &&
    ((value.status === "ok" && "value" in value) || (value.status === "error" && "error" in value));
}

function toFetchError(cause: unknown) {
  return isAbortError(cause)
    ? new HttpContractAbortError({ cause })
    : new HttpContractFetchError({ cause });
}

function toBodyError(cause: unknown, kind: BodyReaderRuntime["kind"]) {
  if (isAbortError(cause)) return new HttpContractAbortError({ cause });
  if (kind === "json") return new HttpContractJsonParseError({ cause });
  return new HttpContractBodyReadError({ cause });
}

function isAbortError(cause: unknown) {
  return typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
}

function getErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

async function buildHeaders(state: EndpointState, endpointHeaders: HeadersInput, hasBody: boolean) {
  const headers: HeadersInput = {};
  for (const [key, value] of Object.entries(state.api.headers ?? {})) {
    headers[key] = String(await resolveValue(value));
  }

  Object.assign(headers, endpointHeaders);
  if (hasBody && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function buildUrl(state: EndpointState, path: Record<string, PathParamValue>, endpointQuery: QueryInput) {
  const url = new URL(interpolatePath(state.template, path), state.api.baseUrl);
  const baseQuery: QueryInput = {};

  for (const [key, value] of Object.entries(state.api.query ?? {})) {
    baseQuery[key] = await resolveValue(value);
  }

  for (const [key, value] of Object.entries({ ...baseQuery, ...endpointQuery })) {
    appendQuery(url, key, value);
  }

  return url;
}

function interpolatePath(template: string, path: Record<string, PathParamValue>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = path[key];
    if (value === undefined) throw new Error(`Missing path parameter: ${key}`);
    return encodeURIComponent(stringifyParam(value));
  });
}

function extractDefaultPath(template: string) {
  const path: Record<string, string> = {};
  for (const match of template.matchAll(/\{([^}]+)\}/g)) {
    path[match[1]!] = "";
  }
  return path;
}

function hasPathParams(template: string) {
  return /\{[^}]+\}/.test(template);
}

function appendQuery(url: URL, key: string, value: QueryValue) {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) url.searchParams.append(key, stringifyParam(item));
    return;
  }
  url.searchParams.set(key, stringifyParam(value));
}

async function resolveValue<T>(value: ValueFactory<T>) {
  return typeof value === "function" ? await (value as () => MaybePromise<T>)() : value;
}

function stringifyParam(value: PathParamValue) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function hasHeader(headers: HeadersInput, name: string) {
  return Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
}
