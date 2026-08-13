import type { StandardSchemaV1 } from "@standard-schema/spec";
import { TaggedError } from "better-result";

export class SchemaValidationError<Source extends string> extends TaggedError("SchemaValidationError")<{
  source: Source,
  issues?: readonly StandardSchemaV1.Issue[]
}> {}

export class BodyReadError<Source extends string> extends TaggedError("BodyReadError")<{
  source: Source,
  cause?: unknown
}> {}

export class BodySerializationError<Source extends string> extends TaggedError("BodySerializationError")<{
  source: Source,
  cause?: unknown
}> {}

export class NetworkError extends TaggedError("NetworkError")<{ cause?: unknown }> {}
