import type { ApiClient } from "@tsuz/api";

export interface AdminUser {
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

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserListParams {
  page: number;
  page_size: number;
  keyword?: string;
  is_active?: boolean;
  is_blacklisted?: boolean;
}

export interface AdminUserCreate {
  email: string;
  display_name?: string | null;
  password: string;
  is_active?: boolean;
}

export interface AdminUserUpdate {
  email?: string | null;
  display_name?: string | null;
  version: number;
}

export interface UserStatusReason {
  reason: string;
}

export interface AdminPasswordReset {
  new_password: string;
}

export interface AdminRoleSummary {
  id: number;
  name: string;
  description: string;
  is_enabled: boolean;
}

export interface AdminRoleListResponse {
  items: AdminRoleSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserRoleAssignment {
  role_ids: number[];
  version: number;
}

export interface AdminUserRolesResponse {
  user_id: number;
  roles: AdminRoleSummary[];
  version: number;
  changed: boolean;
  revoked_sessions: number;
}

export interface AdminUserActionResponse extends AdminUser {
  changed: boolean;
  revoked_sessions?: number;
}

export interface AdminPasswordResetResponse {
  message: string;
  revoked_sessions: number;
}

export interface AdminForceLogoutResponse {
  message: string;
  revoked_sessions: number;
}

export function listAdminUsers(client: ApiClient, params: AdminUserListParams) {
  return client.get<AdminUserListResponse>("/admin/users", {
    query: {
      page: params.page,
      page_size: params.page_size,
      keyword: params.keyword || undefined,
      is_active: params.is_active,
      is_blacklisted: params.is_blacklisted
    }
  });
}

export function createAdminUser(client: ApiClient, body: AdminUserCreate) {
  return client.post<AdminUser>("/admin/users", body);
}

export function getAdminUser(client: ApiClient, userId: number) {
  return client.get<AdminUser>(`/admin/users/${userId}`);
}

export function updateAdminUser(client: ApiClient, userId: number, body: AdminUserUpdate) {
  return client.patch<AdminUserActionResponse>(`/admin/users/${userId}`, body);
}

export function disableAdminUser(client: ApiClient, userId: number, reason: string) {
  return client.post<AdminUserActionResponse>(`/admin/users/${userId}/disable`, { reason });
}

export function enableAdminUser(client: ApiClient, userId: number) {
  return client.post<AdminUserActionResponse>(`/admin/users/${userId}/enable`);
}

export function blacklistAdminUser(client: ApiClient, userId: number, reason: string) {
  return client.post<AdminUserActionResponse>(`/admin/users/${userId}/blacklist`, { reason });
}

export function recoverAdminUser(client: ApiClient, userId: number) {
  return client.post<AdminUserActionResponse>(`/admin/users/${userId}/recover`);
}

export function resetAdminUserPassword(client: ApiClient, userId: number, newPassword: string) {
  return client.post<AdminPasswordResetResponse>(`/admin/users/${userId}/reset-password`, {
    new_password: newPassword
  });
}

export function forceLogoutAdminUser(client: ApiClient, userId: number) {
  return client.post<AdminForceLogoutResponse>(`/admin/users/${userId}/force-logout`);
}

export function listAssignableAdminRoles(client: ApiClient) {
  return client.get<AdminRoleListResponse>("/admin/roles", {
    query: { page: 1, page_size: 100, is_enabled: true }
  });
}

export function getAdminUserRoles(client: ApiClient, userId: number) {
  return client.get<AdminUserRolesResponse>(`/admin/users/${userId}/roles`);
}

export function replaceAdminUserRoles(client: ApiClient, userId: number, body: AdminUserRoleAssignment) {
  return client.put<AdminUserRolesResponse>(`/admin/users/${userId}/roles`, body);
}
