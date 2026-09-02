# admin-permissions 权限管理模块实施方案

> 状态：部分完成；本阶段代码与本地质量门禁已完成，真实测试环境写操作需受控联调。
>
> 阶段计划：[ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 阶段执行记录：[ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_EXECUTION.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> API 基准：[测试环境 Swagger UI](https://test-api.tusz.online/docs#/admin-permissions) / [OpenAPI JSON](https://test-api.tusz.online/openapi.json)

## 1. 目标与范围

在现有管理员子应用 `/permissions` 路由接入 `admin-permissions`，提供权限分页列表、关键词/资源/声明状态/启用状态筛选、详情、显示元数据编辑，以及启用/禁用操作。启用状态使用表格 Switch；详情和编辑集中在表格操作列，视觉与交互复用 `admin-users` 模式。

## 2. 已确认契约

- `GET /admin/permissions` 支持 `page`、`page_size`、`keyword`、`resource`、`is_declared`、`is_enabled`，返回分页数据。
- `GET /admin/permissions/{permission_id}` 返回权限详情和 endpoints。
- `PATCH /admin/permissions/{permission_id}` 更新 `display_name`、`description`，必须携带 `version`。
- `POST /admin/permissions/{permission_id}/disable` 接收可选 `reason`（最多 500 字符）。
- `POST /admin/permissions/{permission_id}/enable` 无请求体。
- 所有请求复用现有 `createMfeApiClient` 的 API base URL、Bearer token 和 401 logout。

## 3. 非目标

不实现权限创建、删除、批量操作、角色/权限完整管理页、后端迁移或未授权的测试环境写操作。

## 4. 设计与安全

API 类型和路径集中在 `admin-permissions-api.ts`。页面使用 TanStack Query 管理列表/详情缓存，mutation 成功后刷新权限列表，失败不乐观修改 Switch；编辑提交当前 `version`，冲突时提示并刷新。密码、Token 和完整错误 payload 不进入日志；真实写操作仅在受控账号和明确授权下执行。

## 5. 阶段顺序

### 第一阶段：列表与权限操作

阶段计划：[第一阶段计划](./ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md)

实现列表筛选分页、启用 Switch、禁用原因表单、启用确认、详情 endpoints、显示元数据编辑及定向测试。

验收：列表和筛选 query 正确；Switch 调用正确 endpoint；操作列提供详情/编辑；version 正确提交；失败不产生错误本地状态；本地 lint、format、test、build 通过。

真实 API 联调作为受控环境验证单独记录，不将未执行内容标为通过。
