import { createApiClient } from "@tsuz/api";
import { DEFAULT_API_BASE_URL, type MicroAppProps } from "@tsuz/shared";

export function createMfeApiClient(props: Partial<MicroAppProps> = {}) {
  return createApiClient({
    baseUrl: props.apiBaseUrl ?? resolveDefaultApiBaseUrl(),
    getAccessToken: props.getAccessToken,
    onUnauthorized: props.logout
  });
}

function resolveDefaultApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}
