import type { ApiClient } from "@tsuz/api";

export interface AdminResourceScope {
  id: number;
  target_app_id: string;
  scope_code: string;
  description: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminResourceScopeListResponse {
  items: AdminResourceScope[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminResourceScopeListParams {
  page: number;
  page_size: number;
  target_app_id?: string;
  is_enabled?: boolean;
}

export interface AdminResourceScopeCreate {
  target_app_id: string;
  scope_code: string;
  description: string;
}

export interface AdminResourceScopeActionResponse extends AdminResourceScope {
  changed: boolean;
}

export function listAdminResourceScopes(client: ApiClient, params: AdminResourceScopeListParams) {
  return client.get<AdminResourceScopeListResponse>("/admin/resource-scopes", {
    query: {
      page: params.page,
      page_size: params.page_size,
      target_app_id: params.target_app_id || undefined,
      is_enabled: params.is_enabled
    }
  });
}

export function createAdminResourceScope(client: ApiClient, body: AdminResourceScopeCreate) {
  return client.post<AdminResourceScope>("/admin/resource-scopes", body);
}

export function disableAdminResourceScope(client: ApiClient, scopeId: number) {
  return client.post<AdminResourceScopeActionResponse>(`/admin/resource-scopes/${scopeId}/disable`);
}

export function enableAdminResourceScope(client: ApiClient, scopeId: number) {
  return client.post<AdminResourceScopeActionResponse>(`/admin/resource-scopes/${scopeId}/enable`);
}
