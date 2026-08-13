import { z } from "zod";
import { method, path, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";

const deletePost = jsonPlaceholder.endpoint(
  method("DELETE"),
  path("/posts/{id}", z.object({
    id: z.number().int().positive()
  })),
  responseBody(z.object({}))
);

const response = await deletePost.fetch({ path: { id: 1 } });
const body = await response.valid.body();

console.log("05 - delete post", {
  status: response.status,
  body
});
