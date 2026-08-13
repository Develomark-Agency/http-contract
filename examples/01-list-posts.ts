import { z } from "zod";
import { method, OpenAIJSONSchemaAdapter, path, query, responseBody, responseHeaders } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";
import { postSchema } from "./schemas.ts";

const listPosts = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts"),
  query(z.object({
    userId: z.number().int().positive().optional()
  })),
  responseBody(z.array(postSchema)),
  responseHeaders(z.object({ whatever: z.string() }))
);

const adapter = new OpenAIJSONSchemaAdapter(listPosts);

const res = await listPosts.fetch(adapter.decode({ method: null, query: { userId: null } }));
const data = await res.valid.body();

console.log(data);
