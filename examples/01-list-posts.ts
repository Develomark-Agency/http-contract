import { z } from "zod";
import { method, path, query, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";
import { postSchema } from "./schemas.ts";

const listPosts = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts"),
  query(z.object({
    userId: z.number().int().positive().optional(),
  })),
  responseBody(z.array(postSchema)),
);

const response = await listPosts.fetch({
  query: { userId: 1 },
});
const posts = await response.valid.body();

console.log("01 - list posts", {
  status: response.status,
  count: posts.length,
  firstTitle: posts[0]?.title,
});
