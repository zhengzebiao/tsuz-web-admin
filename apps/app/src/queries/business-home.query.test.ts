import { describe, expect, test } from "vitest";
import { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";
import { businessHomeQueryKey, loadBusinessHomeSummary } from "./business-home.query";

describe("business home query", () => {
  test("creates stable query keys", () => {
    expect(businessHomeQueryKey()).toEqual(["business-home", DEFAULT_API_BASE_URL, "guest"]);
    expect(businessHomeQueryKey("https://api.example.test", "user-1")).toEqual([
      "business-home",
      "https://api.example.test",
      "user-1"
    ]);
  });

  test("returns deterministic starter metrics", async () => {
    const currentUser: CurrentUser = {
      id: "user-1",
      name: "Demo Admin",
      username: "admin",
      roles: ["admin"],
      permissions: ["mfe:read"]
    };

    await expect(loadBusinessHomeSummary({ apiBaseUrl: "https://api.example.test", currentUser })).resolves.toMatchObject({
      apiBaseUrl: "https://api.example.test",
      currentUserName: "Demo Admin",
      metrics: expect.arrayContaining([expect.objectContaining({ label: "Open orders" })])
    });
  });
});
