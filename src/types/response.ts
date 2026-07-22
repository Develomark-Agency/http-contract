import type { Op as ProdkitOp } from "@prodkit/op";
import type { Result as BetterResult } from "better-result";
import type { BuiltInBodyError } from "../errors";
import type { ResponseMode } from "./common";

type BodyReader<Output, Errors, Mode extends ResponseMode> =
  Mode extends "op" ? ProdkitOp<Output, Errors | BuiltInBodyError, []> :
  Mode extends "result" ? Promise<BetterResult<Output, Errors | BuiltInBodyError>> :
  Promise<Output>;

export type TypedResponse<Output, Errors, Mode extends ResponseMode = "throw", ReadOutput = Output> =
  Omit<Response, "json" | "text" | "blob" | "arrayBuffer" | "formData" | "clone"> & {
    read(): BodyReader<ReadOutput, Errors, Mode>;
    json(): BodyReader<Output, Errors, Mode>;
    text(): BodyReader<Output, Errors, Mode>;
    blob(): BodyReader<Output, Errors, Mode>;
    arrayBuffer(): BodyReader<Output, Errors, Mode>;
    formData(): BodyReader<Output, Errors, Mode>;
    clone(): TypedResponse<Output, Errors, Mode, ReadOutput>;
  };
