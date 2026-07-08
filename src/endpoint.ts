import { Op } from "@prodkit/op";
import { Result, type Result as BetterResult } from "better-result";
import { attachRequestContext, HttpContractRequestBuildError, toFetchError, type RequestContext } from "./errors";
import { createTypedResponse } from "./response";
import { normalizeHookResult } from "./result-utils";
import { validateInput } from "./schema";
import { buildHeaders, buildUrl, extractDefaultPath, hasPathParams } from "./url";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type {
  BodyKind,
  BodyOptions,
  BodySerializer,
  Endpoint,
  EndpointState,
  HeadersInput,
  HttpMethod,
  PathParamValue,
  QueryInput,
  ResponseMode,
  RuntimeContext,
  SchemaOutput,
  SerializableParamRecord,
  TypedResponse
} from "./types";

export function createEndpoint(state: EndpointState) {
  const call = (async (args: Record<string, unknown> = {}) => {
    const result = await execute(state, args, "throw");
    if (result.isErr()) throw result.error;
    return result.value;
  }) as any;

  call.result = (args: Record<string, unknown> = {}) => execute(state, args, "result") as unknown as Promise<BetterResult<TypedResponse<unknown, unknown, "result">, unknown>>;
  call.result.url = (args: Record<string, unknown> = {}) => buildUrlResult(state, args) as unknown as Promise<BetterResult<URL, unknown>>;
  call.op = (args: Record<string, unknown> = {}) => Op.try(async () => {
    const result = await execute(state, args, "op");
    if (result.isErr()) throw result.error;
    return result.value as unknown as TypedResponse<unknown, unknown, "op">;
  }, error => error);
  call.op.url = (args: Record<string, unknown> = {}) => Op.try(async () => {
    const result = await buildUrlResult(state, args);
    if (result.isErr()) throw result.error;
    return result.value;
  }, error => error);

  call.method = (method: HttpMethod) => createEndpoint({ ...state, method, methodSet: true });
  call.path = (schema: StandardSchema) => {
    if (!hasPathParams(state.template)) {
      throw new Error(`Cannot define path schema for endpoint without path parameters: ${state.template}`);
    }
    return createEndpoint({ ...state, pathSchema: schema });
  };
  call.query = (schema: StandardSchema) => createEndpoint({ ...state, querySchema: schema });
  call.requestHeaders = (schema: StandardSchema) => createEndpoint({ ...state, requestHeadersSchema: schema });
  call.responseHeaders = (schema: StandardSchema) => createEndpoint({ ...state, responseHeadersSchema: schema });
  call.body = (schema: StandardSchema, options?: BodyOptions) => createEndpoint({ ...state, bodySchema: schema, bodySerializer: resolveBodySerializer(options) });
  call.output = (schema: StandardSchema) => createEndpoint({ ...state, outputSchema: schema }) as unknown as Endpoint<string, string, {
    methodSet: boolean;
    path: unknown;
    query: unknown;
    body: unknown;
    headers: unknown;
    output: SchemaOutput<typeof schema>;
    errors: unknown;
  }>;
  call.validate = (validate: EndpointState["validate"]) => createEndpoint({ ...state, validate });
  call.transform = (transform: EndpointState["transform"]) => createEndpoint({ ...state, transform }) as any;

  call.url = async (args: Record<string, unknown> = {}) => {
    const result = await buildUrlResult(state, args);
    if (result.isErr()) throw result.error;
    return result.value;
  };

  return call;
}

async function execute(state: EndpointState, args: Record<string, unknown>, mode: ResponseMode) {
  const fetchImpl = state.api.fetch ?? globalThis.fetch;
  const requestOptions = getRequestOptions(args);
  const method = (state.methodSet ? state.method : (requestOptions.method ?? state.method)).toUpperCase();
  const requestCtx: RequestContext = { method, url: state.template };

  const path = await validateInput(state.pathSchema, args.path ?? extractDefaultPath(state.template), "path");
  if (path.isErr()) { attachRequestContext(path.error, requestCtx); return path; }

  const endpointQuery = await validateInput(state.querySchema, args.query ?? {}, "query");
  if (endpointQuery.isErr()) { attachRequestContext(endpointQuery.error, requestCtx); return endpointQuery; }

  const endpointHeaders = await validateInput(state.requestHeadersSchema, args.headers ?? {}, "headers");
  if (endpointHeaders.isErr()) { attachRequestContext(endpointHeaders.error, requestCtx); return endpointHeaders; }

  const body = await validateInput(state.bodySchema, args.body, "body");
  if (body.isErr()) { attachRequestContext(body.error, requestCtx); return body; }

  let url: URL;
  let headers: HeadersInput;
  let init: RequestInit;
  try {
    url = await buildUrl(state, path.value as Record<string, PathParamValue>, endpointQuery.value as QueryInput);
    headers = await buildHeaders(state, endpointHeaders.value as SerializableParamRecord, state.bodySchema !== undefined);
    requestCtx.url = url.toString();
    init = {
      ...requestOptions,
      method,
      headers
    };

    if (state.bodySchema !== undefined) {
      const serialize = state.bodySerializer?.serialize ?? JSON.stringify;
      init.body = serialize(body.value) as any;
    }
  } catch (cause) {
    const err = new HttpContractRequestBuildError({ cause });
    attachRequestContext(err, requestCtx);
    return Result.err(err);
  }

  for (const hook of state.api.onRequest ?? []) {
    const hookResult = normalizeHookResult(await hook({ url, init }));
    if (hookResult.isErr()) { attachRequestContext(hookResult.error, requestCtx); return hookResult; }
  }

  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (cause) {
    const err = toFetchError(cause);
    attachRequestContext(err, requestCtx);
    return Result.err(err);
  }

  for (const hook of state.api.onResponse ?? []) {
    const hookResult = normalizeHookResult(await hook({ res, url, init }));
    if (hookResult.isErr()) { attachRequestContext(hookResult.error, requestCtx); return hookResult; }
  }

  const responseHeaders = await validateInput(state.responseHeadersSchema, headersToRecord(res.headers), "responseHeaders");
  if (responseHeaders.isErr()) { attachRequestContext(responseHeaders.error, requestCtx); return responseHeaders; }

  const ctx: RuntimeContext = {
    res,
    path: path.value as Record<string, PathParamValue>,
    query: endpointQuery.value as QueryInput,
    headers,
    method,
    url
  };

  if (state.validate) {
    const validation = normalizeHookResult(await state.validate(ctx));
    if (validation.isErr()) { attachRequestContext(validation.error, requestCtx); return validation; }
  }

  return Result.ok(createTypedResponse(state, res, ctx, mode));
}

function headersToRecord(headers: Headers) {
  const record: SerializableParamRecord = {};
  for (const [key, value] of headers) {
    record[key] = value;
  }
  return record;
}

async function buildUrlResult(state: EndpointState, args: Record<string, unknown>) {
  const pathResult = await validateInput(state.pathSchema, args.path ?? extractDefaultPath(state.template), "path");
  if (pathResult.isErr()) return pathResult;

  const queryResult = await validateInput(state.querySchema, args.query ?? {}, "query");
  if (queryResult.isErr()) return queryResult;

  try {
    return Result.ok(await buildUrl(state, pathResult.value as Record<string, PathParamValue>, queryResult.value as QueryInput));
  } catch (cause) {
    return Result.err(new HttpContractRequestBuildError({ cause }));
  }
}

function getRequestOptions(args: Record<string, unknown>) {
  const {
    path: _path,
    query: _query,
    body: _body,
    headers: _headers,
    ...requestOptions
  } = args;

  return requestOptions as Omit<RequestInit, "body" | "headers"> & { method?: HttpMethod };
}

function resolveBodySerializer(options?: BodyOptions): BodySerializer | undefined {
  if (!options) return undefined;

  if (options.serialize) {
    return {
      contentType: options.contentType,
      serialize: options.serialize,
    };
  }

  const kind: BodyKind = options.kind ?? "json";
  switch (kind) {
    case "json":
      return { contentType: options.contentType ?? "application/json", serialize: JSON.stringify };
    case "form-data": {
      const result: BodySerializer = { serialize: (v) => v as any };
      if (options.contentType) result.contentType = options.contentType;
      return result;
    }
    case "url-encoded":
      return { contentType: options.contentType ?? "application/x-www-form-urlencoded", serialize: (v) => v as any };
    case "binary":
      return { contentType: options.contentType ?? "application/octet-stream", serialize: (v) => v as any };
    case "text":
      return { contentType: options.contentType ?? "text/plain", serialize: String };
  }
}
