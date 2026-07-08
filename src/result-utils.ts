import { Result, type Result as BetterResult } from "better-result";

export function normalizeHookResult(value: unknown) {
  if (isResult(value)) return value.status === "ok" ? Result.ok(undefined) : Result.err(value.error);
  if (value === undefined) return Result.ok(undefined);
  return Result.err(value);
}

export function normalizeTransformResult(value: unknown, fallback: unknown) {
  if (isResult(value)) return value;
  if (value === undefined) return Result.ok(fallback);
  return Result.ok(value);
}

function isResult(value: unknown): value is BetterResult<unknown, unknown> {
  return typeof value === "object" && value !== null && "status" in value &&
    ((value.status === "ok" && "value" in value) || (value.status === "error" && "error" in value));
}
