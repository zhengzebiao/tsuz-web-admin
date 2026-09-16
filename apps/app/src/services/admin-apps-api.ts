import type { ApiClient } from "@tsuz/api";

export interface AdminApp {
  id: number;
  app_id: string;
  name: string;
  icon_url: string | null;
  access_url: string;
  service_account_name: string;
  is_enabled: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  secret_updated_at: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface AdminAppListResponse {
  items: AdminApp[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminAppListParams {
  page: number;
  page_size: number;
  keyword?: string;
  is_enabled?: boolean;
}

export interface AdminAppCreate {
  name: string;
  icon_url?: string | null;
  access_url: string;
  service_account_name: string;
}

export interface AdminAppCreateResponse {
  app: AdminApp;
  app_secret: string;
}

export interface AdminAppUpdate {
  name?: string | null;
  icon_url?: string | null;
  access_url?: string | null;
  service_account_name?: string | null;
  version: number;
}

export interface AdminAppActionResponse extends AdminApp {
  changed: boolean;
}

export function listAdminApps(client: ApiClient, params: AdminAppListParams) {
  return client.get<AdminAppListResponse>("/admin/apps", {
    query: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword || undefined,
      is_enabled: params.is_enabled
    }
  });
}

export function createAdminApp(client: ApiClient, body: AdminAppCreate) {
  return client.post<AdminAppCreateResponse>("/admin/apps", body);
}

export function getAdminApp(client: ApiClient, appRecordId: number) {
  return client.get<AdminApp>(`/admin/apps/${appRecordId}`);
}

export function updateAdminApp(client: ApiClient, appRecordId: number, body: AdminAppUpdate) {
  return client.patch<AdminAppActionResponse>(`/admin/apps/${appRecordId}`, body);
}

export function disableAdminApp(client: ApiClient, appRecordId: number, reason?: string | null) {
  return client.post<AdminAppActionResponse>(`/admin/apps/${appRecordId}/disable`, {
    reason: reason?.trim() || null
  });
}

export function enableAdminApp(client: ApiClient, appRecordId: number) {
  return client.post<AdminAppActionResponse>(`/admin/apps/${appRecordId}/enable`);
}
