import z from "zod";
import { type APIConnector, method, middleware, path, responseBody } from "../index";
import { jsonPlaceholder } from "./client";
import { postSchema } from "./schemas";
import { headersToRecord } from "../internal";

const cacheStore = new Map<string, Promise<Response>>();

function makeCacheKey(request: Readonly<APIConnector.RequestContext>) {
  let res = `${request.init.method ?? "GET"}::${request.url.href}`;

  const h: Array<[string, string]> = [];
  for(const [key, value] of Object.entries(headersToRecord(request.init.headers ?? {}))) {
    if(value == null) continue;
    if(Array.isArray(value)) {
      for(const v of value) {
        h.push([key, v]);
      }
    } else {
      h.push([key, String(value)]);
    }
  }

  if(h.length > 0) {
    h.sort(([keyA, valueA], [keyB, valueB]) => {
      return keyA.localeCompare(keyB) || valueA.localeCompare(valueB);
    });
    res += "::" + JSON.stringify(h);
  }

  return res;
}

let networkRequests = 0;

const getCachedPost = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts/{id}", z.object({
    id: z.number().int().positive()
  })),
  middleware(async (ctx, next) => {
    const key = makeCacheKey(ctx);

    const existing = cacheStore.get(key);
    if(existing) {
      return existing.then(res => res.clone());
    }

    const resPromise = next(ctx);
    networkRequests++;
    const cachedPromise = resPromise.then(res => res.clone());

    cacheStore.set(key, cachedPromise);

    try {
      const [response] = await Promise.all([
        resPromise,
        cachedPromise
      ]);
      return response;
    } catch (e) {
      if(cacheStore.get(key) === cachedPromise) {
        cacheStore.delete(key);
      }

      throw e;
    }
  }),
  responseBody(postSchema)
);

const t0 = Date.now();
console.log("-> Sending first request...");
const res1 = await getCachedPost.fetch({ path: { id: 4 } });
console.log(`<- Got first response (${Date.now() - t0}ms)`);
const data1 = await res1.valid.body();

console.log();

const t1 = Date.now();
console.log("-> Sending second request...");
const res2 = await getCachedPost.fetch({ path: { id: 4 } });
console.log(`<- Got second response (${Date.now() - t1}ms)`);
const data2 = await res2.valid.body();

console.log();
console.log("08 - response cache middleware", {
  firstTitle: data1.title,
  cachedTitle: data2.title,
  networkRequests
});
