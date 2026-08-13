import { z } from "zod";
import {
  APIConnector,
  method,
  path,
  requestHeaders,
  responseBody,
  responseHeaders,
} from "../index.ts";
import { userSchema } from "./schemas.ts";

const api = new APIConnector(async () => ({
  baseUrl: "https://jsonplaceholder.typicode.com",
  headers: async () => ({
    Accept: "application/json",
    "X-Client": "http-contract-example",
  }),
}));

const getUser = api.endpoint(
  method("GET"),
  path("/users/{id}", z.object({
    id: z.number().int().positive(),
  })),
  requestHeaders(z.object({
    "X-Request-Id": z.string(),
  })),
  responseBody(userSchema),
  responseHeaders(
    z.record(z.string(), z.string()).transform(headers => headers["content-type"]),
  ),
);

const response = await getUser.fetch({
  path: { id: 1 },
  headers: { "X-Request-Id": crypto.randomUUID() },
});
const user = await response.valid.body();

console.log("06 - headers and async config", {
  user: user.username,
  contentType: response.valid.headers.headers,
});
