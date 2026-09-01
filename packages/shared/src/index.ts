export type AuthStatus = "anonymous" | "authenticating" | "authenticated";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface AuthBridge {
  getAccessToken: () => string | undefined;
  getCurrentUser: () => CurrentUser | undefined;
  logout: () => void;
}

export interface MicroAppMeta {
  name: string;
  title: string;
  activeRule: string;
  basename: string;
  port: number;
}

export interface MicroAppProps extends AuthBridge {
  appName: string;
  basename: string;
  apiBaseUrl: string;
  container?: HTMLElement;
}

export const MFE_APP_ROUTE = "/apps/mfe-app";
export const MFE_APP_BASENAME = MFE_APP_ROUTE;
export const DEFAULT_API_BASE_URL = "/api";
export const DEFAULT_MFE_APP_ENTRY = "//localhost:7201";

export const mfeAppMeta = {
  name: "mfe-app",
  title: "Business App",
  activeRule: MFE_APP_ROUTE,
  basename: MFE_APP_BASENAME,
  port: 7201
} as const satisfies MicroAppMeta;

export const microAppMetas = [mfeAppMeta] as const satisfies readonly MicroAppMeta[];

export type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function classNames(...values: ClassValue[]) {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      continue;
    }

    for (const [className, enabled] of Object.entries(value)) {
      if (enabled) {
        classes.push(className);
      }
    }
  }

  return classes.join(" ");
}

export const cx = classNames;

export function matchesActiveRoute(activeRule: string, pathname: string) {
  const normalizedRule = stripTrailingSlashes(activeRule || "/");
  const normalizedPath = stripTrailingSlashes(pathname || "/");

  if (normalizedRule === "/") {
    return normalizedPath === "/";
  }

  return normalizedPath === normalizedRule || normalizedPath.startsWith(normalizedRule + "/");
}

function stripTrailingSlashes(value: string) {
  let normalized = value;

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}
