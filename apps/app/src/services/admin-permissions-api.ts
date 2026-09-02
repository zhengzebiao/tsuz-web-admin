import type { ApiClient } from "@tsuz/api";

export interface AdminPermissionEndpoint {
  http_method: string;
  path: string;
  route_name: string;
}

export interface AdminPermission {
  id: number;
  name: string;
  display_name: string;
  description: string;
  resource: string;
  action: string;
  is_declared: boolean;
  is_enabled: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  missing_at: string | null;
  endpoint_count: number;
  role_count: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface AdminPermissionListResponse {
  items: AdminPermission[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminPermissionListParams {
  page: number;
  page_size: number;
  keyword?: string;
  resource?: string;
  is_declared?: boolean;
  is_enabled?: boolean;
}

export interface AdminPermissionDetailResponse extends AdminPermission {
  endpoints: AdminPermissionEndpoint[];
}

export interface AdminPermissionUpdate {
  display_name?: string | null;
  description?: string | null;
  version: number;
}

export interface AdminPermissionDisableRequest {
  reason?: string | null;
}

export interface AdminPermissionActionResponse extends AdminPermission {
  changed: boolean;
  revoked_sessions: number;
}

export function listAdminPermissions(client: ApiClient, params: AdminPermissionListParams) {
  return client.get<AdminPermissionListResponse>("/admin/permissions", {
    query: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword || undefined,
      resource: params.resource || undefined,
      is_declared: params.is_declared,
      is_enabled: params.is_enabled
    }
  });
}

export function getAdminPermission(client: ApiClient, permissionId: number) {
  return client.get<AdminPermissionDetailResponse>(`/admin/permissions/${permissionId}`);
}

export function updateAdminPermission(client: ApiClient, permissionId: number, body: AdminPermissionUpdate) {
  return client.patch<AdminPermissionActionResponse>(`/admin/permissions/${permissionId}`, body);
}

export function disableAdminPermission(client: ApiClient, permissionId: number, reason?: string) {
  return client.post<AdminPermissionActionResponse>(`/admin/permissions/${permissionId}/disable`, {
    reason: reason || undefined
  });
}

export function enableAdminPermission(client: ApiClient, permissionId: number) {
  return client.post<AdminPermissionActionResponse>(`/admin/permissions/${permissionId}/enable`);
}
