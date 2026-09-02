# admin-permissions 第一阶段实现计划

> 状态：已实施，待真实环境验收
>
> 总方案：[ADMIN_PERMISSIONS_IMPLEMENTATION_PLAN.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PLAN.md)
>
> 执行记录：[ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_EXECUTION.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_EXECUTION.md)

## 1. 阶段目标

1. 接入权限列表、详情、编辑、启用和禁用 API。
2. 参照 `admin-users` 实现筛选、服务端分页、Table、Switch 和操作弹窗。
3. 补充 API/页面测试和质量门禁，保持 qiankun 与 standalone 契约不变。

## 2. 范围

### 实现

- `GET /admin/permissions` 的关键词、资源、声明状态、启用状态筛选和分页；
- `is_enabled` Switch：禁用打开可选原因表单，启用打开确认框；
- 操作列中的权限详情（含 endpoints）和显示元数据编辑；
- PATCH 使用当前 `version`，操作成功刷新查询，失败保持原状态；
- API 映射测试、页面交互测试以及实施文档。

### 不实现

- 权限创建、删除、批量操作；
- 角色权限分配和完整角色管理；
- 数据库迁移、外部服务变更、生产部署；
- 未获授权的真实测试环境写操作。

## 3. 修改文件与设计

- `apps/app/src/services/admin-permissions-api.ts`：OpenAPI 类型及请求映射。
- `apps/app/src/pages/AdminPermissionsPage.tsx`：查询状态、筛选分页、表格、Switch、详情和编辑弹窗。
- 对应 `.test.ts(x)`：路径/query/body/version 与页面交互测试。
- `apps/app/src/styles/main.css`：仅在权限详情 endpoint 表格需要时增加最小样式。

复用 `createMfeApiClient`、`useAppStore`、TanStack Query 和 Ant Design App message。列表 query key 包含页码和筛选；详情按 permission id 隔离。禁用 reason 可空、最多 500 字符；编辑显示名称最多 128 字符、描述最多 255 字符。

## 4. 验证

```bash
pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-permissions-api.test.ts src/pages/AdminPermissionsPage.test.tsx
pnpm lint
pnpm format:check
pnpm test
pnpm build
git diff --check
```

## 5. 验收标准

- [x] 列表分页、筛选和空/错误/重试状态符合契约；
- [x] 启用状态使用 Switch，禁用/启用调用正确接口；
- [x] 详情和编辑只位于操作列，详情展示 endpoints；
- [x] 编辑携带当前 version，失败不产生错误本地状态；
- [x] 定向测试和全量质量门禁通过；
- [x] 执行记录与总方案状态同步。
- [ ] 测试环境真实写操作完成受控联调。

真实 API 写操作需要受控管理员凭证与明确授权；缺少条件时记录为待环境验证。
