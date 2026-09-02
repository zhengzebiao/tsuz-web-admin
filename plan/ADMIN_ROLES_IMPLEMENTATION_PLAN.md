# admin-roles 角色管理模块实施方案

> 状态：已实施；本地质量门禁已完成，真实环境写操作待受控联调
>
> 接口依据：[Swagger UI](https://test-api.tusz.online/docs#/)、[OpenAPI JSON](https://test-api.tusz.online/openapi.json)
>
> 执行记录：[ADMIN_ROLES_IMPLEMENTATION_EXECUTION.md](./ADMIN_ROLES_IMPLEMENTATION_EXECUTION.md)

## 1. 目标与范围

在现有管理员子应用中接入角色管理，UI 延续 `admin-users` 的白底卡片、Ant Design Table、筛选栏、Switch 和弹窗交互。实现角色列表、服务端分页、关键词/启用状态筛选、创建、编辑、详情、启用/禁用、权限分配和关联用户查看。

本期明确不实现角色删除、权限创建、角色用户写操作、批量/导入/导出以及数据库或后端改造。

## 2. 接口契约

| 能力     | 接口                                                          | 前端行为                                  |
| -------- | ------------------------------------------------------------- | ----------------------------------------- |
| 列表     | `GET /admin/roles?page&page_size&keyword&is_enabled`          | Table 服务端分页                          |
| 创建     | `POST /admin/roles`                                           | 创建角色表单；name 1–64，description ≤255 |
| 详情     | `GET /admin/roles/{role_id}`                                  | 只读详情弹窗                              |
| 编辑     | `PATCH /admin/roles/{role_id}`                                | 编辑 name/description，提交 version       |
| 启用     | `POST /admin/roles/{role_id}/enable`                          | 二次确认，无 body                         |
| 禁用     | `POST /admin/roles/{role_id}/disable`                         | 可选 reason 表单，空值发送 null           |
| 权限读取 | `GET /admin/roles/{role_id}/permissions`                      | 多选弹窗回填                              |
| 权限替换 | `PUT /admin/roles/{role_id}/permissions`                      | 提交 permission_ids 和权限响应 version    |
| 权限选项 | `GET /admin/permissions?page=1&page_size=100&is_enabled=true` | 多选选项来源                              |
| 关联用户 | `GET /admin/roles/{role_id}/users?...`                        | 只读分页表格                              |

所有请求复用现有 `createMfeApiClient` 的 API base URL、Bearer Token 和 401 logout。

## 3. 页面设计

- `AdminRolesPage` 提供“创建角色”按钮、关键词/状态筛选、角色 Table 和操作栏。
- 状态 Switch 使用文字 Tag/checked label 表达状态；关闭状态打开禁用原因表单，开启使用确认弹窗。
- “更多”菜单提供编辑、权限、关联用户；不提供删除入口。
- 详情展示 ID、名称、描述、启用状态、禁用原因/时间、创建/更新时间和 version。
- 权限弹窗使用 `Select mode="multiple"`，已绑定但禁用的权限保留并禁选，支持空数组；保存前提示权限变更影响。
- 关联用户弹窗只读展示用户 ID、名称、邮箱、状态和创建时间，支持关键词、状态筛选和分页。

## 4. 实现与异常规则

- API 类型和请求函数集中在 `apps/app/src/services/admin-roles-api.ts`。
- 权限和关联用户逻辑分别抽取到 `apps/app/src/pages/admin-roles/RolePermissionsModal.tsx`、`RoleUsersModal.tsx`。
- TanStack Query key 隔离列表、详情、权限和关联用户筛选；mutation 成功后刷新相关 query。
- 资料编辑和权限替换使用服务端返回的对应 version，避免覆盖并发修改。
- 加载失败提供重试；写失败保留原页面/弹窗状态并提示，不做错误的乐观状态。
- 角色或权限选项超过 100 条时提示当前选项列表不完整，不静默宣称全量加载。

## 5. 测试与验收

- API 测试覆盖所有角色接口的路径、方法、query 和 body，包括创建角色。
- 页面测试覆盖列表、创建入口、创建表单约束、权限弹窗和关联用户只读表格。
- 真实写操作需要受控管理员账号、有效 token 和明确授权；未授权时不执行。

## 6. 文件清单

- `apps/app/src/services/admin-roles-api.ts`：新增角色、权限和关联用户 API。
- `apps/app/src/pages/AdminRolesPage.tsx`：角色列表和核心弹窗。
- `apps/app/src/pages/admin-roles/RolePermissionsModal.tsx`：角色权限分配。
- `apps/app/src/pages/admin-roles/RoleUsersModal.tsx`：关联用户查询。
- `apps/app/src/services/admin-roles-api.test.ts`、`apps/app/src/pages/AdminRolesPage.test.tsx`：角色服务和页面测试。
- `apps/app/src/pages/admin-roles/RolePermissionsModal.test.tsx`、`RoleUsersModal.test.tsx`：子弹窗测试。
- `apps/app/src/styles/main.css`：复用既有用户管理布局样式。
- `plan/ADMIN_ROLES_IMPLEMENTATION_EXECUTION.md`：事实执行记录。
