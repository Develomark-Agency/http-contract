import { TaggedError } from "better-result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export class HttpContractFetchError extends TaggedError("HttpContractFetchError")<{
  cause: unknown;
  message: string;
}>() {
  constructor(args: { cause: unknown }) {
    const message = `Fetch failed: ${getErrorMessage(args.cause)}`;
    super({ ...args, message });
  }
}

export class HttpContractAbortError extends TaggedError("HttpContractAbortError")<{
  cause: unknown;
  message: string;
}>() {
  constructor(args: { cause: unknown }) {
    const message = `Request aborted: ${getErrorMessage(args.cause)}`;
    super({ ...args, message });
  }
}

export class HttpContractRequestBuildError extends TaggedError("HttpContractRequestBuildError")<{
  cause: unknown;
  message: string;
}>() {
  constructor(args: { cause: unknown }) {
    const message = `Failed to build request: ${getErrorMessage(args.cause)}`;
    super({ ...args, message });
  }
}

export class HttpContractSchemaError extends TaggedError("HttpContractSchemaError")<{
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
  message: string;
}>() {
  constructor(args: { issues: ReadonlyArray<StandardSchemaV1.Issue> }) {
    const firstMsg = args.issues[0]?.message ?? "Schema validation failed";
    const message = args.issues.length > 1
      ? `${firstMsg} (+${args.issues.length - 1} more issues)`
      : firstMsg;
    super({ ...args, message });
  }
}

export type RequestContext = {
  method: string;
  url: string;
};

export const requestContextKey = Symbol("@http-contract:request_context");

export function attachRequestContext(error: unknown, ctx: RequestContext): void {
  if (typeof error === "object" && error !== null) {
    (error as Record<symbol, unknown>)[requestContextKey] = ctx;
  }
}

export class HttpContractJsonParseError extends TaggedError("HttpContractJsonParseError")<{
  cause: unknown;
  message: string;
}>() {
  constructor(args: { cause: unknown }) {
    const message = `Failed to parse JSON response: ${getErrorMessage(args.cause)}`;
    super({ ...args, message });
  }
}

export class HttpContractBodyReadError extends TaggedError("HttpContractBodyReadError")<{
  cause: unknown;
  message: string;
}>() {
  constructor(args: { cause: unknown }) {
    const message = `Failed to read response body: ${getErrorMessage(args.cause)}`;
    super({ ...args, message });
  }
}

export type BuiltInRequestError =
  | HttpContractRequestBuildError
  | HttpContractFetchError
  | HttpContractAbortError
  | HttpContractSchemaError;

export type BuiltInBodyError =
  | HttpContractJsonParseError
  | HttpContractBodyReadError
  | HttpContractAbortError
  | HttpContractSchemaError;

export function toFetchError(cause: unknown) {
  return isAbortError(cause)
    ? new HttpContractAbortError({ cause })
    : new HttpContractFetchError({ cause });
}

export function toBodyError(cause: unknown, kind: "json" | "body") {
  if (isAbortError(cause)) return new HttpContractAbortError({ cause });
  if (kind === "json") return new HttpContractJsonParseError({ cause });
  return new HttpContractBodyReadError({ cause });
}

export function getErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function isAbortError(cause: unknown) {
  return typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
}
