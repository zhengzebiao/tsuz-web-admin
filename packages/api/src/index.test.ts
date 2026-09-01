import { describe, expect, test } from "vitest";
import { ApiError, createApiClient } from "./index";

describe("createApiClient", () => {
  test("builds URLs with query params and parses JSON", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createApiClient({
      baseUrl: "https://api.example.test/v1",
      fetcher: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    });

    await expect(client.get("/users", { query: { page: 2, archived: false } })).resolves.toEqual({ ok: true });
    expect(String(requests[0].input)).toBe("https://api.example.test/v1/users?page=2&archived=false");
    expect(requests[0].init?.method).toBe("GET");
  });

  test("adds bearer tokens and JSON request bodies", async () => {
    let capturedHeaders: Headers | undefined;
    let capturedBody: BodyInit | null | undefined;
    const client = createApiClient({
      baseUrl: "/api",
      getAccessToken: () => "token-1",
      fetcher: async (_input, init) => {
        capturedHeaders = init?.headers as Headers;
        capturedBody = init?.body;
        return new Response(null, { status: 204 });
      }
    });

    await expect(client.post("/items", { name: "Demo" })).resolves.toBeUndefined();
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer token-1");
    expect(capturedHeaders?.get("Content-Type")).toBe("application/json");
    expect(capturedBody).toBe(JSON.stringify({ name: "Demo" }));
  });

  test("calls unauthorized handler and throws ApiError for failed responses", async () => {
    let unauthorized = false;
    const client = createApiClient({
      baseUrl: "/api",
      onUnauthorized: () => {
        unauthorized = true;
      },
      fetcher: async () =>
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
    });

    await expect(client.get("/private")).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toBe(true);
  });
});
