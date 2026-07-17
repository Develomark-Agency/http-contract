import { Op } from "@prodkit/op";
import { Result, type Result as BetterResult } from "better-result";
import { attachRequestContext, attachResponseContext, toBodyError, type RequestContext, type ResponseContext } from "./errors";
import { normalizeTransformResult } from "./result-utils";
import { validateInput } from "./schema";
import type { EndpointState, ResponseMode, RuntimeContext } from "./types/index";

type BodyReaderRuntime = {
  kind: "json" | "body";
  read: (response: Response) => Promise<unknown>;
};

export function createTypedResponse(state: EndpointState, res: Response, ctx: RuntimeContext, mode: ResponseMode) {
  const wrap = (reader: BodyReaderRuntime) => {
    if (mode === "op") {
      return () => Op.try(async () => {
        const result = await readBodyResult(state, res, ctx, reader);
        if (result.isErr()) throw result.error;
        return result.value;
      }, error => error);
    }

    return async () => finishBodyResult(await readBodyResult(state, res, ctx, reader), mode);
  };

  return new Proxy(res, {
    get(target, prop) {
      if (prop === "json") return wrap({ kind: "json", read: response => response.json() });
      if (prop === "text") return wrap({ kind: "body", read: response => response.text() });
      if (prop === "blob") return wrap({ kind: "body", read: response => response.blob() });
      if (prop === "arrayBuffer") return wrap({ kind: "body", read: response => response.arrayBuffer() });
      if (prop === "formData") return wrap({ kind: "body", read: response => response.formData() });
      if (prop === "clone") {
        return () => createTypedResponse(state, target.clone() as unknown as Response, ctx, mode);
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

async function readBodyResult(state: EndpointState, res: Response, ctx: RuntimeContext, reader: BodyReaderRuntime) {
  const requestCtx: RequestContext = { method: ctx.method, url: String(ctx.url) };
  const responseCtx: ResponseContext = { status: res.status, statusText: res.statusText };

  const parsed = await Result.tryPromise({
    try: () => reader.read(res.clone() as unknown as Response),
    catch: cause => toBodyError(cause, reader.kind)
  });
  if (parsed.isErr()) {
    attachRequestContext(parsed.error, requestCtx);
    attachResponseContext(parsed.error, responseCtx);
    return parsed;
  }

  const output = await validateInput(state.outputSchema, parsed.value, "output");
  if (output.isErr()) {
    attachRequestContext(output.error, requestCtx);
    attachResponseContext(output.error, responseCtx);
    return output;
  }

  if (state.transform) {
    const transformed = normalizeTransformResult(await state.transform({ ...ctx, value: output.value }), output.value);
    if (transformed.isErr()) {
      attachRequestContext(transformed.error, requestCtx);
      attachResponseContext(transformed.error, responseCtx);
      return transformed;
    }
    return Result.ok(transformed.value);
  }

  return Result.ok(output.value);
}

function finishBodyResult(result: BetterResult<unknown, unknown>, mode: ResponseMode) {
  if (mode === "result") return result;
  if (result.isErr()) throw result.error;
  return result.value;
}
