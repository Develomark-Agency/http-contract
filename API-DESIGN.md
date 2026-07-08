# http-contract-3 API Design

## Overview

A type-safe HTTP client library that lets you define API contracts with Zod schemas, then consume them through three error-handling styles: **throw**, **Result**, and **Op (generator)**.

---

## Defining an API

```ts
import { defineApi } from "http-contract-3";
import z from "zod";

const api = defineApi({
  baseUrl: "https://jsonplaceholder.typicode.com",

  // Optional custom fetch (testing, env compat, auth transport)
  fetch: globalThis.fetch,

  // Base headers merged into every request.
  // Values can be constants or sync/async factories.
  headers: {
    Authorization: async () => `Bearer ${await getToken()}`,
    "Cache-Control": "no-cache",
  },

  // Base query params merged into every request.
  // Values can be constants, sync/async factories, or arrays.
  query: {
    apiKey: "abc123",
    locale: () => navigator.language,
  },
});
```

**Merge semantics**: Base `headers`/`query` are shallow-merged with endpoint-level values. Endpoint values win on conflict.

---

## Defining Endpoints

```ts
const postSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  body: z.string(),
});

// GET /posts?userId=<number>
const listPosts = api.endpoint("/posts")
  .method("get")                              // default, can omit
  .query(z.object({ userId: z.number().optional() }))
  .output(z.array(postSchema));

// GET /posts/:postId
const getPost = api.endpoint("/posts/{postId}")
  .path(z.object({ postId: z.number() }))
  .output(postSchema)
  .validate(ctx => {
    if (ctx.res.status === 404) {
      return Result.fail(new NotFoundError({ id: ctx.path.postId }));
    }
  })
  .transform(ctx => {
    if (ctx.value.title.includes("lorem")) {
      return Result.fail(new BadPostError({ post: ctx.value }));
    }
    return Result.ok({
      ...ctx.value,
      title: ctx.value.title.toUpperCase(),
    });
  });

// POST /posts
const createPost = api.endpoint("/posts")
  .method("post")
  .body(z.object({
    userId: z.number(),
    title: z.string(),
    body: z.string(),
  }))
  .output(postSchema);
```

### Builder chain order-dependence

| Step           | Depends on             | Notes |
|----------------|------------------------|-------|
| `.method(m)`   | nothing                | `"get"` is default |
| `.path(s)`     | nothing                | Adds path template vars + types `path` in call args |
| `.query(s)`    | nothing                | Adds `query` in call args |
| `.requestHeaders(s)` | nothing          | Adds `headers` in call args |
| `.body(s)`     | nothing                | Adds `body` in call args; auto-sets `Content-Type: application/json` |
| `.responseHeaders(s)` | nothing          | Only validates, doesn't add to call args |
| `.output(s)`   | nothing                | Schema validated against the parsed body |
| `.validate(fn)` | `.output`, `.query`, `.path`, `.requestHeaders` if `ctx` needs them | Gates on status / raw response; return `void` or `Result.fail`. Cannot follow `.transform` |
| `.transform(fn)` | `.output`            | Validates AND maps parsed output; return `Result.ok(T)` or `Result.fail(E)`. Only one `.transform` allowed. |

---

## Calling Endpoints

### Throw mode

```ts
const response = await getPost({ path: { postId: 1 } });
// response is TypedResponse — looks like Response, but carries extra type info

const post = await response.json();
// Throws on:
//   - network error
//   - schema validation failure (output schema)
//   - any Result.fail from .validate or .transform
```

### Result mode

```ts
const responseResult = await getPost.result({ path: { postId: 1 } });
if (responseResult.isFail()) return;  // network error, .validate fail, etc.

const postResult = await responseResult.value.json();
if (postResult.isFail()) return;      // schema validation fail, .transform fail

const post = postResult.value;
```

### Op mode (generator)

```ts
import { Op } from "@prodkit/op";

const fetch = Op(function* (postId: number) {
  const response = yield* getPost.op({ path: { postId } });
  const post = yield* response.json();
  return post;
});

const result = await fetch.run(1);
```

---

## .validate (pre-body-read)

Runs **before** the body is read. Receives the raw `Response` plus any declared variables.

```ts
.validate(ctx => {
  // ctx has:
  //   ctx.res     — the Response object
  //   ctx.path    — path params (if .path was called)
  //   ctx.query   — query params (if .query was called)
  //   ctx.headers — request headers (if .requestHeaders was called)

  if (ctx.res.status === 404) {
    return Result.fail(new NotFoundError({ id: ctx.path.postId }));
  }
  // Return void / undefined to continue to body read
})
```

Returns `void` to continue, or `Result.fail(E)` to short-circuit.

Error types returned here are added to the endpoint's error union.

---

## .transform (post-body-read)

Runs **after** the body is parsed and validated against `.output(schema)`. Receives the parsed value plus the same context as `.validate`.

```ts
.transform(ctx => {
  // ctx has everything from .validate, plus:
  //   ctx.value   — parsed & output-validated body

  if (ctx.value.title.includes("lorem")) {
    return Result.fail(new BadPostError({ post: ctx.value }));
  }

  return Result.ok({
    ...ctx.value,
    title: ctx.value.title.toUpperCase(),
  });
})
```

- Return `Result.ok(T)` to replace the output value (both runtime and type-level).
- Return `Result.fail(E)` to produce an error (added to the error union).
- Error types from `.transform` are unioned with `.validate` error types and built-in error types.

---

## Body Readers

The `TypedResponse` exposes multiple body readers. Each one runs the same post-body pipeline: parse → `.output(schema)` validate → `.transform`.

```ts
const post = await response.json();         // JSON.parse then validate + transform
const text = await response.text();          // raw string then validate + transform
const blob = await response.blob();          // blob, no validate unless schema allows it
const arrayBuffer = await response.arrayBuffer();
const formData = await response.formData();
```

For non-JSON formats, `.output(schema)` might use `z.string().transform(csvParse)` and the consumer calls `.text()`.

---

## Type Flow Summary

```
Endpoint definition chain:

  api.endpoint("/posts/{id}")
    .method("post")
    .path(z.object({ id: z.number() }))         → CallArgs now has { path: { id: number } }
    .query(z.object({ page: z.number() }))      → CallArgs now has { query: { page: number } }
    .body(z.object({ title: z.string() }))      → CallArgs now has { body: { title: string } }
    .requestHeaders(z.object({ "x-trace": z.string() })) → CallArgs now has { headers: { "x-trace": string } }
    .output(postSchema)                          → ParsedType = z.output<typeof postSchema>
    .validate(fn)                                → ErrorUnion += return type of fn
    .transform(fn)                               → FinalType = ok branch ; ErrorUnion += fail branch

Usage modes:

  endpoint(args)                                 → Promise<TypedResponse>
    TypedResponse.json()                         → Promise<FinalType> (throws)
    TypedResponse.text()                         → Promise<FinalType> (throws)

  endpoint.result(args)                          → Promise<Result<TypedResponse, ErrorUnion>>
    TypedResponse.json()                         → Result<FinalType, ErrorUnion + builtins>
    TypedResponse.text()                         → Result<FinalType, ErrorUnion + builtins>

  endpoint.op(args)                              → Op<Result<TypedResponse, ErrorUnion>, never>
    TypedResponse.json()                         → Op<Result<FinalType, ErrorUnion + builtins>, never>
```

---

## Built-in Error Types

Errors that can always occur regardless of `.validate`/`.transform`:

- `NetworkError` — fetch itself failed (DNS, timeout, CORS, etc.)
- `ParseError` — body reader parse failure (invalid JSON, etc.)
- `ValidationError` — `.output(schema)` validation failure
- `HttpError` — non-2xx status that wasn't handled by `.validate`

These are automatically unioned into the error types returned by `.result()` and `.op()`.

---

## HTTP Methods

```ts
.method("get")     // default
.method("post")
.method("put")
.method("patch")
.method("delete")
.method("head")
.method("options")
```

The type allows `string & {}` so any method string is accepted while still suggesting the common ones.

---

## Summary

The core loop:

1. Define the base client with `defineApi(...)` — shared `fetch`, `headers`, `query`
2. Chain endpoint config — `path`, `query`, `body`, `requestHeaders`, `output`, `responseHeaders`, `validate`, `transform`
3. Call in one of three modes — `endpoint(args)`, `endpoint.result(args)`, `endpoint.op(args)`
4. Read the body — `.json()`, `.text()`, etc. — same semantics per mode
