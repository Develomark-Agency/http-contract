import type { EndpointState, HeadersInput, PathParamValue, QueryInput, QueryValue, SerializableParamRecord, ValueFactory, MaybePromise } from "./types";

export async function buildHeaders(state: EndpointState, endpointHeaders: SerializableParamRecord, hasBody: boolean) {
  const headers: HeadersInput = {};
  for (const [key, value] of Object.entries(state.api.headers ?? {})) {
    headers[key] = String(await resolveValue(value));
  }

  for (const [key, value] of Object.entries(endpointHeaders)) {
    if (value === undefined) continue;
    headers[key] = stringifyHeaderValue(value);
  }

  if (hasBody && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export async function buildUrl(state: EndpointState, path: Record<string, PathParamValue>, endpointQuery: QueryInput) {
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

export function extractDefaultPath(template: string) {
  const path: Record<string, string> = {};
  for (const match of template.matchAll(/\{([^}]+)\}/g)) {
    path[match[1]!] = "";
  }
  return path;
}

export function hasPathParams(template: string) {
  return /\{[^}]+\}/.test(template);
}

function interpolatePath(template: string, path: Record<string, PathParamValue>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = path[key];
    if (value === undefined) throw new Error(`Missing path parameter: ${key}`);
    return encodeURIComponent(stringifyParam(value));
  });
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

function stringifyHeaderValue(value: Exclude<QueryValue, undefined>) {
  return Array.isArray(value) ? value.map(stringifyParam).join(", ") : stringifyParam(value);
}

function hasHeader(headers: HeadersInput, name: string) {
  return Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
}
