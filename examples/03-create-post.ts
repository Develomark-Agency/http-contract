import { method, path, requestBody, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";
import { postDraftSchema, postSchema } from "./schemas.ts";

const createPost = jsonPlaceholder.endpoint(
  method("POST"),
  path("/posts"),
  requestBody(postDraftSchema),
  responseBody(postSchema)
);

const response = await createPost.fetch({
  body: {
    userId: 1,
    title: "A typed HTTP contract",
    body: "The request and response both pass their schemas."
  }
});
const created = await response.valid.body();

console.log("03 - create post", {
  status: response.status,
  id: created.id,
  title: created.title
});
