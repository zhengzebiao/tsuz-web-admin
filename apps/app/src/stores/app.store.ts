import { create } from "zustand";
import { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";
import type { MfeAppProps } from "../qiankun";

export type AppRuntimeMode = "standalone" | "qiankun";

export interface AppRuntimeState {
  mode: AppRuntimeMode;
  appName: string;
  basename: string;
  apiBaseUrl: string;
  hasAuthBridge: boolean;
  currentUser?: CurrentUser;
  hostProps?: MfeAppProps;
  lastMountedBy: string;
}

interface AppStore extends AppRuntimeState {
  setHostProps: (props?: MfeAppProps) => void;
  resetHostProps: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  ...createInitialAppState(),
  setHostProps: (props = {}) => {
    const mode = resolveRuntimeMode(props);

    set({
      mode,
      appName: props.appName ?? "mfe-app",
      basename: props.basename ?? "/",
      apiBaseUrl: props.apiBaseUrl ?? resolveDefaultApiBaseUrl(),
      hasAuthBridge: Boolean(props.getAccessToken),
      currentUser: readCurrentUser(props),
      hostProps: props,
      lastMountedBy: mode === "qiankun" ? "qiankun host" : "standalone mode"
    });
  },
  resetHostProps: () => set(createInitialAppState())
}));

function createInitialAppState(): AppRuntimeState {
  const mode = resolveRuntimeMode();

  return {
    mode,
    appName: "mfe-app",
    basename: "/",
    apiBaseUrl: resolveDefaultApiBaseUrl(),
    hasAuthBridge: false,
    currentUser: undefined,
    hostProps: undefined,
    lastMountedBy: mode === "qiankun" ? "qiankun host" : "standalone mode"
  };
}

function resolveDefaultApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

function resolveRuntimeMode(props: MfeAppProps = {}): AppRuntimeMode {
  if (props.container || isPoweredByQiankun()) {
    return "qiankun";
  }

  return "standalone";
}

function isPoweredByQiankun() {
  return typeof window !== "undefined" && Boolean(window.__POWERED_BY_QIANKUN__);
}

function readCurrentUser(props: MfeAppProps) {
  try {
    return props.getCurrentUser?.();
  } catch {
    return undefined;
  }
}
