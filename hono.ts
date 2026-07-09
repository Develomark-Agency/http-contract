import { Op, type Op as ProdkitOp } from "@prodkit/op";
import { Result, type Result as BetterResult } from "better-result";

const responseReaders: Record<string, true> = {
  arrayBuffer: true,
  blob: true,
  bytes: true,
  formData: true,
  json: true,
  text: true,
};

const passthroughClientFunctions: Record<string, true> = {
  $path: true,
  $url: true,
  $ws: true,
};

export function apiFromHono<const T extends object>(client: T): ApiFromHono<T> {
  return wrapClientNode(client) as ApiFromHono<T>;
}

function wrapClientNode<T extends object>(node: T): T {
  return new Proxy(node, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value === "function") {
        if (isEndpointCall(prop)) return wrapEndpointCall(value as HonoEndpointCall);
        if (typeof prop === "string" && prop.startsWith("$")) return value;
        return wrapClientNode(value);
      }

      if (value && typeof value === "object") return wrapClientNode(value);
      return value;
    }
  });
}

function isEndpointCall(prop: PropertyKey) {
  return typeof prop === "string" && prop.startsWith("$") && !passthroughClientFunctions[prop];
}

function wrapEndpointCall<T extends HonoEndpointCall>(call: T): HonoEndpoint<T> {
  const wrapped = ((...args: Parameters<T>) => call(...args)) as HonoEndpoint<T>;

  wrapped.result = (async (...args: Parameters<T>) => {
    const result = await Result.tryPromise({
      try: () => call(...args),
      catch: error => error,
    });

    if (result.isErr()) return result;
    return Result.ok(wrapResponse(result.value as AsyncReturn<T>, "result"));
  }) as HonoEndpoint<T>["result"];

  wrapped.op = Op(function* (...args: any[]) {
    const response = yield* Op.try(
      () => call(...args as Parameters<T>),
      error => error,
    );
    return wrapResponse(response as AsyncReturn<T>, "op");
  }) as unknown as HonoEndpoint<T>["op"];

  return wrapped;
}

function wrapResponse<T extends ResponseLike>(response: T, mode: "result"): HonoResultResponse<T>;
function wrapResponse<T extends ResponseLike>(response: T, mode: "op"): HonoOpResponse<T>;
function wrapResponse<T extends ResponseLike>(response: T, mode: "result" | "op") {
  return new Proxy(response, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && responseReaders[prop]) {
        return mode === "result"
          ? () => Result.tryPromise({
              try: () => (target[prop as keyof T] as BodyReader).call(target),
              catch: error => error,
            })
          : () => Op.try(
              () => (target[prop as keyof T] as BodyReader).call(target),
              error => error,
            );
      }

      if (prop === "clone") {
        return () => wrapResponse(target.clone() as T, mode as never);
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

type HonoEndpointCall = (...args: any[]) => Promise<ResponseLike>;
type BodyReader = () => Promise<unknown>;
type BodyReaderName = "arrayBuffer" | "blob" | "bytes" | "formData" | "json" | "text";
type ResponseLike = Response & Partial<Record<"bytes", () => Promise<Uint8Array>>>;

type AsyncReturn<T> = T extends (...args: any[]) => infer R ? Awaited<R> : never;
type ReaderReturn<T, K extends BodyReaderName> = T extends Record<K, (...args: any[]) => infer R> ? Awaited<R> : never;

type HonoResultResponse<T extends ResponseLike> = Omit<T, BodyReaderName | "clone"> & {
  [K in BodyReaderName as K extends keyof T ? K : never]: () => Promise<BetterResult<ReaderReturn<T, K>, unknown>>;
} & {
  clone(): HonoResultResponse<T>;
};

type HonoOpResponse<T extends ResponseLike> = Omit<T, BodyReaderName | "clone"> & {
  [K in BodyReaderName as K extends keyof T ? K : never]: () => ProdkitOp<ReaderReturn<T, K>, unknown, []>;
} & {
  clone(): HonoOpResponse<T>;
};

type HonoEndpoint<T extends HonoEndpointCall> = T & {
  result: (...args: Parameters<T>) => Promise<BetterResult<HonoResultResponse<AsyncReturn<T>>, unknown>>;
  op: ProdkitOp<HonoOpResponse<AsyncReturn<T>>, unknown, Parameters<T>>;
};

export type ApiFromHono<T> =
  T extends HonoEndpointCall ? HonoEndpoint<T> :
  T extends (...args: any[]) => any ? T :
  T extends object ? { [K in keyof T]: ApiFromHono<T[K]> } :
  T;
