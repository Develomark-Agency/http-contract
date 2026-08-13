import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

export type URLSafeValue = string | number | boolean | bigint | Date;
export type Schema<In = any, Out = In> = StandardSchemaV1<In, Out> & StandardJSONSchemaV1<In, Out>

export type Nullable<T> = T | null | undefined;
export type PromiseOr<T> = T | Promise<T>
export type ArrayOr<T> = T | T[];
export type GetterOr<T> = T | (() => PromiseOr<T>)

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type Flatten<T> = {
  [K in keyof T]: T[K]
} & {}

export type UnionToIntersection<U> = Flatten<(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never>;

type IsEmptyish<T> =
  {} extends T ? true
  : undefined extends T ? true
  : false;

export type OptionalizeEmpties<T> = Flatten<{
  [K in keyof T as IsEmptyish<T[K]> extends true ? K : never]?: T[K]
} & {
  [K in keyof T as IsEmptyish<T[K]> extends true ? never : K]: T[K]
}>

export type RemoveNevers<T> = Flatten<{
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}>

type IsActuallyEmpty<T> = undefined extends T
  ? keyof NonNullable<T> extends never
    ? true
    : false
  : false

export type RemoveEmpties<T> = Flatten<{
  [K in keyof T as IsActuallyEmpty<T[K]> extends true ? never : K]: T[K]
}>

type S = RemoveEmpties<{
  hello?: { what?: string } | undefined,
  world: "string"
}>

export type BodyReader =
  | "arrayBuffer"
  | "blob"
  | "bytes"
  | "formData"
  | "json"
  | "text";

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

export type BodyReaderOutput = {
  [K in BodyReader]: K extends "json" ? JSONValue : Awaited<ReturnType<Response[K]>>
}

export function defaultSerializeValue(value: URLSafeValue) {
  if(value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

export async function resolvePrimitive<T extends URLSafeValue>(x: GetterOr<T>): Promise<T> {
  return typeof x === "function" ? await x() : x;
}

export async function resolvePrimitiveRecord<
  T extends Record<PropertyKey, GetterOr<URLSafeValue>>
>(x: GetterOr<T>) {
  const record = typeof x === "function" ? await x() : x;

  const all = await Promise.all(Object.entries(record).map(async ([k, v]) => {
    return [k, await resolvePrimitive(v)] as const;
  }));

  return Object.fromEntries(all) as {
    [K in keyof T]: T[K] extends (() => infer R extends URLSafeValue)
      ? Awaited<ReturnType<typeof resolvePrimitive<R>>>
      : T[K] extends GetterOr<infer R>
        ? R
        : never;
  };
}

function mergeRecords(a: Record<PropertyKey, any>, b: Record<PropertyKey, any>) {
  const result: Record<PropertyKey, any> = {}

  for(const [key, value] of Object.entries(a)) {
    if(value != null) {
      result[key] = value;
    }
  }

  for(const [key, value] of Object.entries(b)) {
    if(value === null) delete result[key];
    if(value != null) {
      if(Array.isArray(result[key]) && Array.isArray(value)) {
        result[key] = [...result[key], ...value];
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

function headersToRecord(headers: string[][] | Record<string, string | ReadonlyArray<string> | undefined> | Headers) {
  return Object.fromEntries(headers instanceof Headers ? headers : Object.entries(headers));
}

export function mergeRequestInit(a?: RequestInit, b?: RequestInit) {
  return {
    ...a,
    ...b,
    headers: mergeRecords(
      headersToRecord(a?.headers ?? {}),
      headersToRecord(b?.headers ?? {})
    ) ?? {}
  }
}