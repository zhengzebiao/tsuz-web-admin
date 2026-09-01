import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";
import { useAppStore } from "./app.store";

beforeEach(() => {
  useAppStore.getState().resetHostProps();
});

describe("app store", () => {
  test("uses standalone defaults", () => {
    const state = useAppStore.getState();

    expect(state.mode).toBe("standalone");
    expect(state.appName).toBe("mfe-app");
    expect(state.basename).toBe("/");
    expect(state.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(state.hasAuthBridge).toBe(false);
  });

  test("stores qiankun host props and current user", () => {
    const currentUser: CurrentUser = {
      id: "user-1",
      name: "Demo Admin",
      username: "admin",
      roles: ["admin"],
      permissions: ["mfe:read"]
    };

    useAppStore.getState().setHostProps({
      appName: "mfe-app",
      basename: "/apps/mfe-app",
      apiBaseUrl: "https://api.example.test",
      getAccessToken: () => "host-token",
      getCurrentUser: () => currentUser,
      logout: () => undefined,
      container: {} as HTMLElement
    });

    const state = useAppStore.getState();

    expect(state.mode).toBe("qiankun");
    expect(state.basename).toBe("/apps/mfe-app");
    expect(state.apiBaseUrl).toBe("https://api.example.test");
    expect(state.hasAuthBridge).toBe(true);
    expect(state.currentUser?.username).toBe("admin");
    expect(state.lastMountedBy).toBe("qiankun host");
  });

  test("reset clears host-derived state", () => {
    useAppStore.getState().setHostProps({
      apiBaseUrl: "https://api.example.test",
      getAccessToken: () => "host-token"
    });

    useAppStore.getState().resetHostProps();

    const state = useAppStore.getState();
    expect(state.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(state.hasAuthBridge).toBe(false);
    expect(state.hostProps).toBeUndefined();
  });
});
