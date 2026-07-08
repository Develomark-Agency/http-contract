import { Op } from "@prodkit/op";
import { Result, type Result as BetterResult } from "better-result";
import { HttpContractRequestBuildError, toFetchError } from "./errors";
import { createTypedResponse } from "./response";
import { normalizeHookResult } from "./result-utils";
import { validateInput } from "./schema";
import { buildHeaders, buildUrl, extractDefaultPath, hasPathParams } from "./url";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";
import type {
  Endpoint,
  EndpointState,
  HeadersInput,
  HttpMethod,
  PathParamValue,
  QueryInput,
  ResponseMode,
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
  call.op = (args: Record<string, unknown> = {}) => Op.try(async () => {
    const result = await execute(state, args, "op");
    if (result.isErr()) throw result.error;
    return result.value as unknown as TypedResponse<unknown, unknown, "op">;
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
  call.body = (schema: StandardSchema) => createEndpoint({ ...state, bodySchema: schema });
  call.output = (schema: StandardSchema) => createEndpoint({ ...state, outputSchema: schema }) as unknown as Endpoint<string, string, boolean, unknown, unknown, unknown, unknown, SchemaOutput<typeof schema>, unknown>;
  call.validate = (validate: EndpointState["validate"]) => createEndpoint({ ...state, validate });
  call.transform = (transform: EndpointState["transform"]) => createEndpoint({ ...state, transform }) as any;

  call.url = async (args: Record<string, unknown> = {}) => {
    const path = await validateInput(state.pathSchema, args.path ?? extractDefaultPath(state.template), "path");
    if (path.isErr()) throw path.error;

    const endpointQuery = await validateInput(state.querySchema, args.query ?? {}, "query");
    if (endpointQuery.isErr()) throw endpointQuery.error;

    return buildUrl(state, path.value as Record<string, PathParamValue>, endpointQuery.value as QueryInput);
  };

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
    headers = await buildHeaders(state, endpointHeaders.value as SerializableParamRecord, state.bodySchema !== undefined);
    const requestOptions = getRequestOptions(args);
    const method = state.methodSet ? state.method : (requestOptions.method ?? state.method);
    init = {
      ...requestOptions,
      method: method.toUpperCase(),
      headers
    };

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

  const responseHeaders = await validateInput(state.responseHeadersSchema, headersToRecord(res.headers), "responseHeaders");
  if (responseHeaders.isErr()) return responseHeaders;

  const ctx = {
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

function headersToRecord(headers: Headers) {
  const record: SerializableParamRecord = {};
  for (const [key, value] of headers) {
    record[key] = value;
  }
  return record;
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
