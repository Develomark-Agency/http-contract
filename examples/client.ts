import { APIConnector } from "../index.ts";

export const jsonPlaceholder = new APIConnector({
  baseUrl: "https://jsonplaceholder.typicode.com",
  headers: {
    Accept: "application/json",
  },
});
