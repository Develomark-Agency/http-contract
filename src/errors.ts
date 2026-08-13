import type { StandardSchemaV1 } from "@standard-schema/spec";
import { TaggedError } from "better-result";

/**
 * Reports input or response data that failed Standard Schema validation.
 * `source` identifies the modifier and `issues` contains vendor-neutral paths
 * and messages from the schema.
 */
export class SchemaValidationError<Source extends string> extends TaggedError("SchemaValidationError")<{
  source: Source,
  issues?: readonly StandardSchemaV1.Issue[]
}> {}

/**
 * Reports a failure while reading or transforming a response body.
 * Inspect `source` to find the modifier and `cause` for the original error.
 */
export class BodyReadError<Source extends string> extends TaggedError("BodyReadError")<{
  source: Source,
  cause?: unknown
}> {}

/**
 * Reports a failure while transforming or serializing a request body.
 * The original thrown value is available through `cause` when present.
 */
export class BodySerializationError<Source extends string> extends TaggedError("BodySerializationError")<{
  source: Source,
  cause?: unknown
}> {}

/**
 * Reports a failure from the configured fetch function.
 * HTTP error status codes do not cause this error; it covers failures where
 * fetch could not produce a response.
 */
export class NetworkError extends TaggedError("NetworkError")<{ cause?: unknown }> {}
