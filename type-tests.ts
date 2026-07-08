import z from "zod";
import {
  defineApi,
  HttpContractAbortError,
  HttpContractFetchError,
  HttpContractJsonParseError,
  HttpContractRequestBuildError,
  HttpContractSchemaError
} from "./index";

const api = defineApi({
  baseUrl: "https://jsonplaceholder.typicode.com"
});

const defaultPath = api.endpoint("/posts/{postId}");

defaultPath({ path: { postId: 123 } });
defaultPath({ path: { postId: "abc" } });
defaultPath({ path: { postId: new Date() } });
defaultPath({ path: { postId: 123 }, cache: "no-store", signal: new AbortController().signal });

// @ts-expect-error Template path params are required.
defaultPath({});

// @ts-expect-error Template path params use the template key.
defaultPath({ path: { id: 123 } });

const refinedPath = api.endpoint("/posts/{postId}")
  .path(z.object({ postId: z.number() }));

refinedPath({ path: { postId: 123 } });

// @ts-expect-error .path(schema) narrows the call type.
refinedPath({ path: { postId: "abc" } });

// @ts-expect-error .path(schema) is unavailable without template path params.
api.endpoint("/posts").path(z.object({ postId: z.number() }));

// @ts-expect-error Path schema output must include all template path keys.
api.endpoint("/users/{userId}/posts/{postId}").path(z.object({ userId: z.string() }));

// @ts-expect-error Path schema output values must be URL-stringifiable.
api.endpoint("/posts/{postId}").path(z.object({ postId: z.object({ bad: z.string() }) }));

refinedPath.url({ path: { postId: 123 } });

// @ts-expect-error .url() path key mismatch.
refinedPath.url({ path: { id: 123 } });

const optionalQueryUrl = api.endpoint("/posts")
  .query(z.object({ id: z.number().optional() }));

optionalQueryUrl.url({});
optionalQueryUrl.url({ query: {} });
optionalQueryUrl.url({ query: { id: 1 } });

const requiredQueryUrl = api.endpoint("/posts")
  .query(z.object({ id: z.number() }));

requiredQueryUrl.url({ query: { id: 1 } });

// @ts-expect-error .url() with required query missing query.
requiredQueryUrl.url({});

// @ts-expect-error .url() with required query missing id.
requiredQueryUrl.url({ query: {} });

api.endpoint("/posts").method("get");
api.endpoint("/posts").method("propfind");
api.endpoint("/posts")({ method: "post", cache: "no-store", signal: new AbortController().signal });

// @ts-expect-error Callsite method is not allowed after endpoint .method(...) is explicit.
api.endpoint("/posts").method("get")({ method: "post" });

const optionalQuery = api.endpoint("/posts")
  .query(z.object({ id: z.number().optional() }));

optionalQuery();
optionalQuery({});
optionalQuery({ query: {} });
optionalQuery({ query: { id: 1 } });

const requiredQuery = api.endpoint("/posts")
  .query(z.object({ id: z.number() }));

// @ts-expect-error Required query params still require call args.
requiredQuery();

// @ts-expect-error Required query params still require the query object.
requiredQuery({});

requiredQuery({ query: { id: 1 } });

// @ts-expect-error Request header schema output must be a serializable record.
api.endpoint("/posts").requestHeaders(z.number());

api.endpoint("/posts").requestHeaders(z.object({
  "X-Custom-Header": z.number(),
  "X-Optional": z.string().optional()
}));

// @ts-expect-error Request header schema output values must be URL/header-stringifiable.
api.endpoint("/posts").requestHeaders(z.object({ "X-Bad": z.object({ nested: z.string() }) }));

// @ts-expect-error Response header schema input must be a serializable record, not a number.
api.endpoint("/posts").responseHeaders(z.number());

api.endpoint("/posts").responseHeaders(z.object({
  "content-type": z.string()
}));

type InferResultError<T> = T extends Promise<infer Result>
  ? Result extends { error: infer Error }
    ? Error
    : never
  : never;
type AssertAssignable<Actual, Expected extends Actual> = true;

type OptionalQueryResponseResult = Awaited<ReturnType<typeof optionalQuery.result>>;
type OptionalQueryOuterError = InferResultError<ReturnType<typeof optionalQuery.result>>;
type _OuterErrorsIncludeDefaults = AssertAssignable<
  OptionalQueryOuterError,
  | HttpContractRequestBuildError
  | HttpContractFetchError
  | HttpContractAbortError
  | HttpContractSchemaError
>;

async function responseBodyErrorTypes() {
  const result = await optionalQuery.result();
  if (result.isErr()) return;

  type BodyError = InferResultError<ReturnType<typeof result.value.json>>;
  type _BodyErrorsIncludeDefaults = AssertAssignable<
    BodyError,
    | HttpContractJsonParseError
    | HttpContractAbortError
    | HttpContractSchemaError
  >;
}
