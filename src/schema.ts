import { Result } from "better-result";
import { HttpContractSchemaError, getErrorMessage } from "../errors.js";
import type { StandardSchemaV1 as StandardSchema } from "@standard-schema/spec";

export async function validateInput(schema: StandardSchema | undefined, value: unknown, label: string) {
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
