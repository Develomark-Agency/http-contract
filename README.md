# http-contract

Type-safe HTTP client with a fluent endpoint builder, schema validation, and three composable error-handling modes.

```ts
const api = defineApi({ baseUrl: "https://api.example.com" });

const getUser = api.endpoint("/users/{id}")
  .path(z.object({ id: z.number() })) // optional, uses `{ id: PathParamValue }` by default
  .output(z.object({ name: z.string(), email: z.string() }));

const res = await getUser({ path: { id: 1 } });
const user = await res.json();
// user: { name: string; email: string }
```

## Installation

Use [`bun add`](https://bun.com/docs/guides/install/add-git) to add this GitHub repository

Validation requires a [Standard Schema](https://standardschema.dev/)-compatible library, such as [Zod](https://zod.dev/) or [ArkType](https://arktype.io/).

`http-contract` is built on two libraries that surface through its API:

- [**better-result**](https://better-result.dev/) -- Every fallible operation returns a `Result<T, E>` type instead of throwing. The `.result()` calling mode, `.validate()`, and `.transform()` all use `Result` from this library.
- [**@prodkit/op**](https://github.com/trvswgnr/prodkit/tree/main/packages/op) -- The `.op()` calling mode returns composable `Op` values that can be combined, retried, and run lazily via `Op.run()`.

You do not need to install these separately; they ship as dependencies of http-contract.

## Define an API Client

Every request originates from a shared API configuration. You set the base URL, default headers, default query parameters, or a custom `fetch` implementation here.

```ts
import { defineApi } from "http-contract";
import z from "zod";

const api = defineApi({
  baseUrl: "https://jsonplaceholder.typicode.com",

  headers: {
    Authorization: async () => `Bearer ${await getToken()}`,
    "Accept": "application/json",
  },

  query: {
    locale: () => navigator.language,
  },
});
```

Values in `headers` and `query` can be constants, sync functions, or async functions. Endpoint-level values are shallow-merged and take precedence over the base values.

## Define an Endpoint

Endpoints are built through a fluent chain. Each step augments the call signature and the response type.

### Path parameters

```ts
const getPost = api.endpoint("/posts/{postId}")
  .path(z.object({ postId: z.number() }))
  .output(z.object({ id: z.number(), title: z.string() }));
```

The `{postId}` template is extracted automatically. Calling `.path(schema)` validates and narrows the input.
If `.path(schema)` is not provided, it's typed as `Record<Param, PathParamValue>`, such as `{ postId: PathParamValue }`

### Query parameters

```ts
const listPosts = api.endpoint("/posts")
  .query(z.object({ userId: z.number().optional() }))
  .output(z.array(postSchema));
```

Required query fields make the call argument required; optional fields make it optional.

### Request body

```ts
const createPost = api.endpoint("/posts")
  .method("post")
  .body(z.object({ title: z.string(), body: z.string() }))
  .output(postSchema);
```

`.body(schema)` adds a `body` field to the call arguments and auto-sets `Content-Type: application/json`. See Body Serialization for other content types.

### Request headers

```ts
api.endpoint("/posts")
  .requestHeaders(z.object({ "X-Trace-Id": z.string() }));
```

Adds a `headers` field to the call arguments.

### Response headers

```ts
api.endpoint("/posts")
  .responseHeaders(z.object({ "X-RateLimit-Remaining": z.coerce.number() }));
```

Validates response headers at runtime and surfaces the validated values through the response context.

### HTTP method

```ts
api.endpoint("/posts").method("post");
api.endpoint("/posts").method("delete");
```

The default method is `"get"`. Once `.method()` is called, the callsite `method` option is disallowed at the type level.

## Calling Modes

Every endpoint can be consumed in three modes, each with a different approach to errors.

### Throw mode (default)

```ts
const res = await getPost({ path: { postId: 1 } });
const post = await res.json();
```

Throws on network failure, schema validation failure, or any error produced by `.validate()` or `.transform()`.

### Result mode

Every fallible step returns a `Result<T, E>` from the [`better-result`](https://better-result.dev/) library. Instead of throwing, you inspect the result with `.isErr()` or `.isOk()` and access `.value` or `.error`.

```ts
import { Result } from "better-result";

const resResult = await getPost.result({ path: { postId: 1 } });
if (resResult.isErr()) return;

const postResult = await resResult.value.json();
if (postResult.isErr()) return;

const post = postResult.value;
```

Error types from hooks and schemas are unioned into the `E` type parameter automatically. This lets TypeScript track exactly which errors an endpoint can produce.

### Op mode

The `.op()` method returns an `Op` from [`@prodkit/op`](https://github.com/trvswgnr/prodkit/tree/main/packages/op). Ops are composable, lazy values -- you build a computation graph by combining Ops, then run it with `Op.run()` to produce a `Result`.

```ts
import { Op } from "@prodkit/op";

const program = Op(function* (id: number) {
  const res = yield* getPost.op({ path: { postId: id } });
  const post = yield* res.json();
  return post;
});

const result = await program.run(1);
```

Because Ops compose, you can combine multiple requests, attach retry policies, or interleave other Op-based logic before executing anything.

## Body Readers

Every `TypedResponse` exposes multiple body readers. All readers run the same pipeline -- parse, validate against `.output(schema)`, then apply `.transform()`.

```ts
await response.json();          // JSON.parse then validate + transform
await response.text();          // raw string
await response.blob();
await response.arrayBuffer();
await response.formData();
```

## Body Serialization

```ts
api.endpoint("/upload")
  .method("post")
  .body(formDataSchema, { kind: "form-data" });

api.endpoint("/data")
  .method("post")
  .body(rawSchema, { kind: "binary" });

api.endpoint("/text")
  .method("post")
  .body(stringSchema, { kind: "text" });
```

Supported kinds: `"json"` (default), `"form-data"`, `"url-encoded"`, `"binary"`, `"text"`.

You can also supply a custom serializer:

```ts
.body(schema, {
  serialize: (value) => JSON.stringify(value, null, 2),
  contentType: "application/json",
});
```

If a serializer provides a `contentType`, it is set as the `Content-Type` header. User-supplied headers take precedence.

## Validate Hook

Runs after the response is received but before the body is read. Use it for status-code checks or early short-circuits. Returns a `Result` from [`better-result`](https://better-result.dev/).

```ts
import { Result } from "better-result";

api.endpoint("/posts/{id}")
  .output(postSchema)
  .validate((ctx) => {
    if (ctx.res.status === 404) {
      return Result.err(new NotFoundError());
    }
  });
```

The context includes `res`, `path`, `query`, and `headers` (based on what was declared). Return `void` to continue or `Result.err(E)` to abort. The error type `E` is added to the endpoint's error union.

## Transform Hook

Runs after the body is parsed and validated against `.output(schema)`. Use it to map or enrich the response value. Returns a `Result` from [`better-result`](https://better-result.dev/).

```ts
import { Result } from "better-result";

api.endpoint("/posts/{id}")
  .output(postSchema)
  .transform((ctx) => {
    return Result.ok({ ...ctx.value, fetchedAt: new Date() });
  });
```

Return `Result.ok(T)` to replace the output value or `Result.err(E)` to produce an error. The transform error type is added to the endpoint's error union.

## URL Builder

Every endpoint exposes URL builders that return the constructed URL without making a request.

```ts
const url = await getPost.url({ path: { postId: 1 } });
const resultUrl = await getPost.result.url({ path: { postId: 1 } });
const opUrl = await getPost.op.url({ path: { postId: 1 } }).run();
```

## Global Interceptors

Requests and responses can be intercepted through `onRequest` and `onResponse` hooks on the API definition. Return `Result.err(E)` from [`better-result`](https://better-result.dev/) to abort the request.

```ts
import { Result } from "better-result";

const api = defineApi({
  baseUrl: "https://api.example.com",
  onRequest: [
    (ctx) => {
      ctx.init.headers = { ...ctx.init.headers, "X-Request-Id": crypto.randomUUID() };
    },
  ],
  onResponse: [
    (ctx) => {
      if (ctx.res.status === 429) return Result.err(new RateLimitError());
    },
  ],
});
```

Hooks run in array order. Returning `Result.err(E)` from any hook aborts the request. Error types from hooks are extracted and unioned into the endpoint's error types.

## Error Types

Built-in errors that can occur regardless of user hooks or schemas:

| Error | Cause |
|-------|-------|
| `HttpContractRequestBuildError` | URL construction or header serialization failure |
| `HttpContractFetchError` | Network failure (DNS, timeout, CORS) |
| `HttpContractAbortError` | Request was aborted via `AbortSignal` |
| `HttpContractSchemaError` | Schema validation failure (input, output, or headers) |
| `HttpContractJsonParseError` | Invalid JSON in response body |
| `HttpContractBodyReadError` | Non-JSON body read failure |

Custom error types from `.validate()`, `.transform()`, `onRequest`, and `onResponse` are automatically unioned into the endpoint's error type.

## Response mode

All body readers clone the underlying `Response` object, so reading the body multiple
times or through multiple methods is safe.

```ts
const res = await getPost({ path: { postId: 1 } });
const json = await res.json();
const text = await res.clone().text();
```