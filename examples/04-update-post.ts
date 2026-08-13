import { z } from "zod";
import { method, path, requestBody, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";
import { postPatchSchema } from "./schemas.ts";

const patchedPostSchema = postPatchSchema.extend({
  id: z.number().int().positive()
});

const updatePost = jsonPlaceholder.endpoint(
  method("PATCH"),
  path("/posts/{id}", z.object({
    id: z.number().int().positive()
  })),
  requestBody(postPatchSchema),
  responseBody(patchedPostSchema)
);

const response = await updatePost.fetch({
  path: { id: 1 },
  body: { title: "A new title" }
});
const updated = await response.valid.body();

console.log("04 - update post", {
  status: response.status,
  post: updated
});
