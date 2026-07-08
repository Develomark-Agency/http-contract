import z from "zod";
import { defineApi } from ".";
import { Result, TaggedError } from "better-result";

class S extends TaggedError("S")() {}

const placeholder = defineApi({
  baseUrl: async () => "https://jsonplaceholder.typicode.com",
  onRequest: [
    () => Result.err(new S())
  ]
});

const getPost = placeholder.endpoint("/posts/{postId}")
  .path(z.object({ postId: z.number() }));

const listPosts = placeholder.endpoint("/posts")
  .query(z.object({ userId: z.number().optional() }));