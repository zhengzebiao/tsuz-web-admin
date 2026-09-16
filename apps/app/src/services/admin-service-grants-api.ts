import type { ApiClient } from "@tsuz/api";

export type AdminServiceGrantStatus = "enabled" | "revoked";

export interface AdminServiceGrant {
  id: number;
  caller_app_id: string;
  scope_id: number;
  target_app_id: string;
  scope_code: string;
  status: AdminServiceGrantStatus;
  valid_from: string;
  expires_at: string | null;
  created_by: number;
  created_at: string;
  revoked_by: number | null;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface AdminServiceGrantListResponse {
  items: AdminServiceGrant[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminServiceGrantListParams {
  page: number;
  page_size: number;
  caller_app_id?: string;
  target_app_id?: string;
  status?: AdminServiceGrantStatus;
}

export interface AdminServiceGrantCreate {
  caller_app_id: string;
  scope_id: number;
  valid_from?: string | null;
  expires_at?: string | null;
}

export interface AdminServiceGrantActionResponse extends AdminServiceGrant {
  changed: boolean;
}

export function listAdminServiceGrants(client: ApiClient, params: AdminServiceGrantListParams) {
  return client.get<AdminServiceGrantListResponse>("/admin/service-grants", {
    query: {
      page: params.page,
      page_size: params.page_size,
      caller_app_id: params.caller_app_id || undefined,
      target_app_id: params.target_app_id || undefined,
      status: params.status
    }
  });
}

export function createAdminServiceGrant(client: ApiClient, body: AdminServiceGrantCreate) {
  return client.post<AdminServiceGrantActionResponse>("/admin/service-grants", {
    caller_app_id: body.caller_app_id,
    scope_id: body.scope_id,
    ...(body.valid_from ? { valid_from: body.valid_from } : {}),
    ...(body.expires_at ? { expires_at: body.expires_at } : {})
  });
}

export function revokeAdminServiceGrant(client: ApiClient, grantId: number, reason?: string | null) {
  return client.post<AdminServiceGrantActionResponse>(`/admin/service-grants/${grantId}/revoke`, {
    reason: reason?.trim() || null
  });
}
