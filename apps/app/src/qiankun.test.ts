import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MfeAppProps } from "./qiankun";

const bootstrapModule = vi.hoisted(() => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock("./bootstrap", () => bootstrapModule);

import { bootstrap, mount, unmount, update } from "./qiankun";

beforeEach(() => {
  bootstrapModule.render.mockClear();
  bootstrapModule.destroy.mockClear();
});

describe("qiankun lifecycle", () => {
  test("bootstrap resolves without side effects", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
    expect(bootstrapModule.render).not.toHaveBeenCalled();
  });

  test("mount delegates to render with host props", async () => {
    const props: MfeAppProps = {
      appName: "mfe-app",
      basename: "/apps/mfe-app",
      apiBaseUrl: "https://api.example.test",
      getAccessToken: () => "host-token",
      getCurrentUser: () => undefined,
      logout: () => undefined
    };

    await mount(props);

    expect(bootstrapModule.render).toHaveBeenCalledWith(props);
  });

  test("unmount delegates to destroy", async () => {
    await unmount();

    expect(bootstrapModule.destroy).toHaveBeenCalledTimes(1);
  });

  test("update remounts with new host props", async () => {
    const props: MfeAppProps = { appName: "mfe-app", apiBaseUrl: "https://api.next.example.test" };

    await update(props);

    expect(bootstrapModule.render).toHaveBeenCalledWith(props);
  });
});
