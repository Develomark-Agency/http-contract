import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { hc } from "hono/client";
import { apiFromHono } from "../hono";

const app = new Hono()
  .get("/echo/:id", (c) => c.text(`${c.req.param("id")}:${c.req.query("q") ?? ""}`))
  .get("/greeting/:name", (c) => c.json({
    message: `Hello, ${c.req.param("name")}`,
    excited: c.req.query("excited") === "yes",
  }));

function createHonoClient() {
  const server = Bun.serve({ fetch: app.fetch, port: 0 });
  const baseUrl = `http://localhost:${server.port}`;
  const client = hc<typeof app>(baseUrl);
  const api = apiFromHono(client);

  return { api, baseUrl, client, server };
}

describe("apiFromHono", () => {
  test("direct wrapped endpoint calls return the same status and body as hc", async () => {
    const { api, client, server } = createHonoClient();

    try {
      const args = { param: { id: "42" }, query: { q: "parity" } };

      const hcResponse = await client.echo[":id"].$get(args);
      const wrappedResponse = await api.echo[":id"].$get(args);

      expect(wrappedResponse.status).toBe(hcResponse.status);
      expect(wrappedResponse.headers.get("content-type")).toBe(hcResponse.headers.get("content-type"));
      expect(await wrappedResponse.text()).toBe(await hcResponse.text());
    } finally {
      server.stop(true);
    }
  });

  test(".result wraps successful responses and body readers in Results", async () => {
    const { api, server } = createHonoClient();

    try {
      const args = {
        param: { id: "7" },
        query: { q: "result" },
      };
      const responseResult = await api.echo[":id"].$get.result(args);

      expect(responseResult.isOk()).toBe(true);
      if (responseResult.isErr()) throw responseResult.error;
      expect(responseResult.value.status).toBe(200);

      const bodyResult = await responseResult.value.text();
      expect(bodyResult.isOk()).toBe(true);
      if (bodyResult.isErr()) throw bodyResult.error;
      expect(bodyResult.value).toBe("7:result");
    } finally {
      server.stop(true);
    }
  });

  test(".result returns Err when the underlying endpoint call rejects", async () => {
    const expectedError = new Error("transport exploded");
    const api = apiFromHono({
      failing: {
        $get: async () => {
          throw expectedError;
        },
      },
    });

    const result = await api.failing.$get.result();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(expectedError);
    }
  });

  test(".op.run accepts endpoint arguments and op body readers return Results", async () => {
    const { api, server } = createHonoClient();

    try {
      const args = {
        param: { name: "Ada" },
        query: { excited: "yes" },
      };
      const responseResult = await api.greeting[":name"].$get.op.run(args);

      expect(responseResult.isOk()).toBe(true);
      if (responseResult.isErr()) throw responseResult.error;
      expect(responseResult.value.status).toBe(200);

      const bodyResult = await responseResult.value.json().run();
      expect(bodyResult.isOk()).toBe(true);
      if (bodyResult.isErr()) throw bodyResult.error;
      expect(bodyResult.value).toEqual({ message: "Hello, Ada", excited: true });
    } finally {
      server.stop(true);
    }
  });

  test("passes through $url and $path with hc return values", () => {
    const { api, baseUrl, client, server } = createHonoClient();

    try {
      const args = { param: { name: "Ada" }, query: { excited: "yes" } };

      const hcUrl = client.greeting[":name"].$url(args);
      const wrappedUrl = api.greeting[":name"].$url(args);
      expect(wrappedUrl).toBeInstanceOf(URL);
      expect(wrappedUrl.href).toBe(hcUrl.href);
      expect(wrappedUrl.href).toBe(`${baseUrl}/greeting/Ada?excited=yes`);

      const hcPath = client.greeting[":name"].$path(args);
      const wrappedPath = api.greeting[":name"].$path(args);
      expect(wrappedPath).toBe(hcPath);
      expect(wrappedPath as string).toBe("/greeting/Ada?excited=yes");
    } finally {
      server.stop(true);
    }
  });
});
