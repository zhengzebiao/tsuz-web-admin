import { describe, expect, test } from "vitest";
import { classNames, DEFAULT_API_BASE_URL, matchesActiveRoute, microAppMetas } from "./index";

describe("shared micro frontend contracts", () => {
  test("exposes default route and API constants", () => {
    expect(DEFAULT_API_BASE_URL).toBe("/api");
    expect(microAppMetas[0].name).toBe("mfe-app");
    expect(microAppMetas[0].activeRule).toBe("/apps/mfe-app");
  });

  test("matches active routes without prefix collisions", () => {
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app")).toBe(true);
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app/settings")).toBe(true);
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app-legacy")).toBe(false);
  });

  test("joins class names from strings and dictionaries", () => {
    expect(classNames("base", { active: true, hidden: false }, undefined, "rounded")).toBe("base active rounded");
  });
});
