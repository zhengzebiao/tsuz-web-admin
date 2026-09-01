import { afterEach, describe, expect, test } from "vitest";
import { createMfeApiClient } from "./api-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createMfeApiClient", () => {
  test("uses the default API base URL when no host prop is provided", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const client = createMfeApiClient();

    await expect(client.get("/health")).resolves.toEqual({ ok: true });
    expect(String(requests[0].input)).toBe("/api/health");
  });

  test("uses host API base URL and bearer token props", async () => {
    let capturedInput: RequestInfo | URL | undefined;
    let capturedHeaders: Headers | undefined;
    let loggedOut = false;

    globalThis.fetch = (async (input, init) => {
      capturedInput = input;
      capturedHeaders = init?.headers as Headers;
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const client = createMfeApiClient({
      apiBaseUrl: "https://api.example.test/v1",
      getAccessToken: () => "host-token",
      logout: () => {
        loggedOut = true;
      }
    });

    await expect(client.get("/private")).rejects.toThrow("API request failed");
    expect(String(capturedInput)).toBe("https://api.example.test/v1/private");
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer host-token");
    expect(loggedOut).toBe(true);
  });
});
