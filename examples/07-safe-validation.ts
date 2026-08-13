import { z } from "zod";
import { method, path, responseBody } from "../index.ts";
import { jsonPlaceholder } from "./client.ts";

const invalidPostSchema = z.object({
  id: z.string(),
});

const getInvalidPost = jsonPlaceholder.endpoint(
  method("GET"),
  path("/posts/1"),
  responseBody(invalidPostSchema),
);

const response = await getInvalidPost.fetch();
const result = await response.valid.body.safe();

if (result.isErr()) {
  console.log("07 - safe validation", {
    error: result.error.name,
    source: result.error.source,
  });
} else {
  console.log(result.value);
}
