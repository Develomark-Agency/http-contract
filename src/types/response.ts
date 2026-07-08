import type { Op as ProdkitOp } from "@prodkit/op";
import type { Result as BetterResult } from "better-result";
import type { BuiltInBodyError } from "../errors.js";
import type { ResponseMode } from "./common.js";

type BodyReader<Output, Errors, Mode extends ResponseMode> =
  Mode extends "op" ? ProdkitOp<Output, Errors | BuiltInBodyError, []> :
  Mode extends "result" ? Promise<BetterResult<Output, Errors | BuiltInBodyError>> :
  Promise<Output>;

export type TypedResponse<Output, Errors, Mode extends ResponseMode = "throw"> =
  Omit<Response, "json" | "text" | "blob" | "arrayBuffer" | "formData" | "clone"> & {
    json(): BodyReader<Output, Errors, Mode>;
    text(): BodyReader<Output, Errors, Mode>;
    blob(): BodyReader<Output, Errors, Mode>;
    arrayBuffer(): BodyReader<Output, Errors, Mode>;
    formData(): BodyReader<Output, Errors, Mode>;
    clone(): TypedResponse<Output, Errors, Mode>;
  };
