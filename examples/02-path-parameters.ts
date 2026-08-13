import { z } from "zod";
import { method, path, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";
import { commentSchema, postSchema } from "./schemas.ts";

const getPost = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts/{id}", z.object({
    id: z.number().int().positive()
  })),
  responseBody(postSchema)
);

const listComments = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts/{postId}/comments", z.object({
    postId: z.number().int().positive()
  })),
  responseBody(z.array(commentSchema))
);

const postResponse = await getPost.fetch({ path: { id: 1 } });
const commentsResponse = await listComments.fetch({ path: { postId: 1 } });

const [post, comments] = await Promise.all([
  postResponse.valid.body(),
  commentsResponse.valid.body()
]);

console.log("02 - path parameters", {
  post: post.title,
  commentCount: comments.length
});
