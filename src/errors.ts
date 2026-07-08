import { TaggedError } from "better-result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
