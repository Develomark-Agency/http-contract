import type { Result as BetterResult } from "better-result";
import { createEndpoint } from "./endpoint";
import type { ApiOptions, DefaultPathParams, Endpoint, PathParamNames } from "./types";

export function defineApi<const T extends ApiOptions>(options: T) {
  type OnResponseErrors = ExtractHookErrors<T["onResponse"]>;

  return {
    endpoint<const Template extends string>(template: Template) {
      return createEndpoint({
        api: options as ApiOptions,
        template,
        method: "get",
        methodSet: false
      }) as unknown as Endpoint<Template, PathParamNames<Template>, false, DefaultPathParams<Template>, never, never, never, unknown, OnResponseErrors>;
    }
  };
}

type ExtractHookErrors<T> =
  T extends readonly unknown[]
    ? { [K in keyof T]: T[K] extends (...args: any[]) => infer R ? ExtractReturnError<R> : never }[number]
    : never;

type ExtractReturnError<R> =
  R extends BetterResult<never, infer E> ? E :
  R extends Promise<infer P> ? ExtractReturnError<P> :
  never;
