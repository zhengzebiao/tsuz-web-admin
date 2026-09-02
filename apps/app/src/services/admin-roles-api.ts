import type { ApiClient } from "@tsuz/api";

export interface AdminRole {
  id: number;
  name: string;
  description: string;
  is_enabled: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface AdminRoleListResponse {
  items: AdminRole[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminRoleListParams {
  page: number;
  page_size: number;
  keyword?: string;
  is_enabled?: boolean;
}

export interface AdminRoleCreate {
  name: string;
  description?: string;
}

export interface AdminRoleUpdate {
  name?: string | null;
  description?: string | null;
  version: number;
}

export interface AdminRoleDisableRequest {
  reason?: string | null;
}

export interface AdminRoleActionResponse extends AdminRole {
  changed: boolean;
  revoked_sessions: number;
}

export interface AdminPermissionSummary {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_declared: boolean;
  is_enabled: boolean;
}

export interface AdminPermissionListResponse {
  items: AdminPermissionSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminRolePermissionsResponse {
  role_id: number;
  permissions: AdminPermissionSummary[];
  version: number;
  changed: boolean;
  revoked_sessions: number;
}

export interface AdminRolePermissionAssignment {
  permission_ids: number[];
  version: number;
}

export interface AdminRoleUsersListResponse {
  items: AdminRoleUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminRoleUser {
  id: number;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_blacklisted: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  blacklisted_at: string | null;
  blacklisted_reason: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export function listAdminRoles(client: ApiClient, params: AdminRoleListParams) {
  return client.get<AdminRoleListResponse>("/admin/roles", {
    query: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword || undefined,
      is_enabled: params.is_enabled
    }
  });
}

export function createAdminRole(client: ApiClient, body: AdminRoleCreate) {
  return client.post<AdminRole>("/admin/roles", body);
}

export function getAdminRole(client: ApiClient, roleId: number) {
  return client.get<AdminRole>(`/admin/roles/${roleId}`);
}

export function updateAdminRole(client: ApiClient, roleId: number, body: AdminRoleUpdate) {
  return client.patch<AdminRoleActionResponse>(`/admin/roles/${roleId}`, body);
}

export function disableAdminRole(client: ApiClient, roleId: number, reason?: string) {
  return client.post<AdminRoleActionResponse>(`/admin/roles/${roleId}/disable`, { reason: reason || null });
}

export function enableAdminRole(client: ApiClient, roleId: number) {
  return client.post<AdminRoleActionResponse>(`/admin/roles/${roleId}/enable`);
}

export function getAdminRolePermissions(client: ApiClient, roleId: number) {
  return client.get<AdminRolePermissionsResponse>(`/admin/roles/${roleId}/permissions`);
}

export function listAdminPermissions(client: ApiClient) {
  return client.get<AdminPermissionListResponse>("/admin/permissions", {
    query: { page: 1, page_size: 100, is_enabled: true }
  });
}

export function replaceAdminRolePermissions(client: ApiClient, roleId: number, body: AdminRolePermissionAssignment) {
  return client.put<AdminRolePermissionsResponse>(`/admin/roles/${roleId}/permissions`, body);
}

export function listAdminRoleUsers(
  client: ApiClient,
  roleId: number,
  params: Omit<AdminRoleListParams, "is_enabled"> & { is_active?: boolean; is_blacklisted?: boolean }
) {
  return client.get<AdminRoleUsersListResponse>(`/admin/roles/${roleId}/users`, {
    query: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword || undefined,
      is_active: params.is_active,
      is_blacklisted: params.is_blacklisted
    }
  });
}
