# 管理端服务访问管理：第 2 阶段“资源范围管理”实现计划

> 状态：部分完成；代码、本地质量门禁和浏览器无副作用检查已完成，真实 API 读写联调待执行
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[第 2 阶段“资源范围管理”执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_EXECUTION.md)
>
> 范围：接入 `admin-resource-scopes` 列表、目标应用筛选、创建与启用/禁用；不提前实现 Service Grants、Scope 编辑/删除或状态级联。

## 1. 背景与阶段基准

### 1.1 前置阶段状态

第 1 阶段“应用管理”的代码与本地质量门禁已经落地，真实环境读写联调仍因 CORS、管理员凭证和写操作授权待执行。该环境遗留不阻塞本阶段的前端实现与 Mock 验证。本阶段可直接复用：

- [`apps/app/src/services/admin-apps-api.ts`](../apps/app/src/services/admin-apps-api.ts) 的 `listAdminApps`、`AdminApp` 和字符串业务 `app_id`；
- [`apps/app/src/services/api-client.ts`](../apps/app/src/services/api-client.ts) 的 API 基地址、Bearer Token 和 401 处理；
- [`apps/app/src/pages/AdminAppsPage.tsx`](../apps/app/src/pages/AdminAppsPage.tsx) 的分页、创建、状态确认和失败重试模式；
- [`apps/app/src/pages/admin-roles/RolePermissionsModal.tsx`](../apps/app/src/pages/admin-roles/RolePermissionsModal.tsx) 的 100 条选项上限提示模式；
- TanStack Query、Ant Design、`PageContainer` 和共享管理页样式。

第 1 阶段详情及遗留项见[执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)。

### 1.2 当前仓库事实

- 实施前 Git 工作区干净，当前分支为 `feat/admin-apps-phase-1`，第 1 阶段提交位于当前 `HEAD`；
- 依赖已安装，不需要新增依赖或修改锁文件；
- 当前导航包含 `/users`、`/roles`、`/permissions`、`/apps`，尚无 Resource Scopes 入口；
- 2026-09-16 重新读取本地测试 API OpenAPI，文档标题为 `tsuz-api-main-test`、版本为 `0.1.0`，Resource Scopes 契约与总方案一致；
- Resource Scopes 只提供列表、创建、禁用和启用，没有详情、编辑或删除接口；
- 列表最大 `page_size` 为 100，支持 `target_app_id` 和 `is_enabled`，不支持按 `scope_code` 搜索；
- Scope 使用数字 `id` 作为状态路径参数，使用字符串 `target_app_id` 关联 Apps 的业务 `app_id`；
- Apps 列表支持最长 128 字符的关键词搜索，可用于远程候选检索，但单次同样最多返回 100 条。

当前代码与总方案没有契约冲突。第 1 阶段真实环境联调尚未完成的事实继续保留，不将其改写为已通过。

### 1.3 本阶段目标

1. 在 `/resource-scopes` 提供可测试的资源范围列表、筛选、创建和启用/禁用管理；
2. 正确区分字符串业务 `target_app_id` 与数字 Scope `id`，并严格映射四个纳入范围的接口；
3. 通过 Apps 远程选择器约束目标应用输入，并对加载失败及 100 条上限提供明确反馈；
4. 保持现有管理模块、认证、qiankun/standalone 和查询缓存契约不变；
5. 补齐定向、全量测试及三类实施文档。

## 2. 范围与约束

### 2.1 本阶段实现

- Scope 目标应用/启用状态筛选、20 条服务端分页、空态、失败和重试；
- 使用 Apps 可搜索下拉选择目标应用，不允许自由文本绕过既有实体；
- 创建 Scope，手工填写 `scope_code` 和可选描述；
- Scope 启用/禁用确认及 `changed` 幂等反馈；
- `/resource-scopes` 导航和路由；
- API、页面、导航测试；
- 总方案、本阶段计划和执行记录同步。

### 2.2 本阶段明确不实现

- Service Grants 的 Service、页面、路由或 Apps/Scopes 联动；
- Scope 详情、编辑、删除、批量操作、导入导出；
- App 禁用、Scope 禁用与现有 Grant 之间的前端级联推断；
- 后端、数据库、部署配置、权限策略或搜索接口改造；
- 未经明确授权的真实环境创建、启用或禁用操作。

### 2.3 已确认约束

- `target_app_id` 必须来自 Apps 候选并提交字符串业务 `app_id`，不得提交 Apps 数字记录 `id`；
- `scope_code` 由管理员手工填写，为 1–128 字符；
- `description` 可选且最长 255 字符，空输入规范化为空字符串；
- 列表的 `target_app_id` 最长 64 字符，`is_enabled: false` 不能在 query 映射时丢失；
- enable/disable 使用数字 Scope `id` 且都不发送请求体；
- Switch 不做乐观更新，请求成功后失效 Scope 查询并以服务端响应重建状态；
- 状态响应 `changed: false` 显示幂等无变化，不伪装为实际状态变更；
- Apps 候选超过 100 条时明确提示结果不完整，并允许通过关键词继续缩小范围；
- 禁用 App 可被标注但不在前端擅自禁止选择，最终约束以后端为准。

### 2.4 临时数据与隔离测试规则

- API 和页面自动化测试全部使用 Mock，不访问长期保留的开发、测试或生产 API；
- 测试使用固定非生产 App ID 和 Scope Code，不保存 Token、Secret 或生产敏感数据；
- 本阶段不涉及 PostgreSQL、Redis、迁移或临时基础设施；
- 如后续获授权执行真实联调，需使用受控测试 App/Scope 命名和明确清理或恢复方案，并单独记录副作用；
- 本阶段不执行生产数据库、生产缓存、生产迁移或部署操作。

### 2.5 前置依赖与环境条件

| 依赖                     | 所需状态                               | 当前状态                          | 不满足时的处理                                   |
| ------------------------ | -------------------------------------- | --------------------------------- | ------------------------------------------------ |
| Apps 前端查询能力        | `listAdminApps` 和业务 `app_id` 已落地 | 已满足；第 1 阶段代码已在当前分支 | 契约漂移则暂停写操作并更新计划                   |
| Resource Scopes OpenAPI  | 路径和 Schema 可读取                   | 已满足；2026-09-16 已重新读取     | 契约变化则以总方案优先级核对并记录差异           |
| 前端依赖                 | 已安装且可运行测试                     | 已满足                            | 报告环境阻塞，不跳过质量门禁                     |
| 真实 API CORS/管理员凭证 | 仅真实联调需要                         | 未满足/未授权                     | 只执行 Mock 和无副作用浏览器检查，标记待环境验证 |

## 3. 详细设计与修改文件

### 3.1 Resource Scopes API Service

新增：

- `apps/app/src/services/admin-resource-scopes-api.ts`：OpenAPI 类型和四个请求函数；
- `apps/app/src/services/admin-resource-scopes-api.test.ts`：路径、方法、query、body、ID 类型和无 body 操作测试。

设计：

1. 列表空 `target_app_id` 映射为 `undefined`，布尔 `false` 原样保留；
2. 创建只提交 `target_app_id`、`scope_code`、`description`；
3. disable/enable 均接收数字 Scope 记录 ID；
4. 两个状态接口都调用无请求体 POST；
5. Service 不承担 Apps 候选组合、Scope 编辑/删除或 Grant 职责。

### 3.2 资源范围管理页面

新增：

- `apps/app/src/pages/AdminResourceScopesPage.tsx`：列表、筛选、分页、Apps 候选、创建和状态确认；
- `apps/app/src/pages/AdminResourceScopesPage.test.tsx`：查询、候选上限/失败、创建、状态和失败边界测试。

设计：

- Scope 列表 query key 包含页码和已应用筛选，根 key 为 `admin-resource-scopes`；
- 表格展示数字记录 ID、字符串目标 App ID、Scope Code、描述、状态、创建时间和更新时间；
- Apps 选择器复用 `listAdminApps`，使用 `page: 1`、`page_size: 100` 和输入关键词远程查询；
- 筛选和创建选择器维护独立搜索词，query key 归入 `admin-apps` 前缀，使第 1 阶段 Apps 变更仍可正确失效候选；
- 候选显示应用名称和业务 `app_id`，禁用应用只标记状态；选中值始终是字符串 `app_id`；
- 当 `total > items.length` 时显示“当前结果不完整”提示，引导继续输入关键词；候选失败时显示错误和重试，不能回退为自由文本；
- 创建字段提交前去除首尾空白，写操作失败时保留 Modal 和表单值；
- 启用和禁用都二次确认，Switch 由服务端查询值控制且提交期间禁用；
- 所有写操作成功后失效 Scope 列表，失败不做乐观更新。

### 3.3 导航和样式

修改：

- `apps/app/src/App.tsx`：增加“资源范围管理”和 `/resource-scopes`；
- `apps/app/src/App.test.tsx`：增加导航覆盖并把菜单数量更新为 5；
- `apps/app/src/styles/main.css`：将 Scopes 分页类加入既有居中规则；
- `README.md`：更新测试覆盖、项目结构和当前导航说明。

页面继续使用 `admin-users-card`、`admin-users-filters` 等既有共享样式，不进行无关命名重构或视觉改版。

### 3.4 数据、迁移或状态

不涉及数据结构、数据库、缓存、队列或持久状态变更。页面状态仅包括：

- Scope 已应用筛选、筛选草稿和页码；
- Apps 远程搜索词及当前成功加载的候选标签；
- 创建 Modal、表单和写操作加载状态。

关闭创建 Modal 后表单组件卸载；不把表单数据写入 Store、Storage 或 URL。

### 3.5 API、Schema 或公共契约

本阶段不改变后端或共享公共契约，只消费：

- `GET /admin/resource-scopes?page&page_size&target_app_id&is_enabled`；
- `POST /admin/resource-scopes`；
- `POST /admin/resource-scopes/{scope_id}/disable`；
- `POST /admin/resource-scopes/{scope_id}/enable`。

关键响应：

```text
ResourceScopeResponse = {
  id, target_app_id, scope_code, description,
  is_enabled, created_at, updated_at
}

ResourceScopeActionResponse = ResourceScopeResponse + { changed }
```

### 3.6 配置、依赖和外部服务

- 不新增依赖、配置、环境变量或锁文件变化；
- 复用现有 API Client 和 Apps Service；
- 本地 OpenAPI 地址不进入应用运行配置；
- TanStack Query 继续沿用全局重试和 30 秒 `staleTime`；
- 自动测试不发起真实 HTTP 写请求。

### 3.7 安全、权限与可观测性

- 后端 Bearer 权限为最终授权边界，前端不绕过 401/403；
- 目标应用只能从后端候选选择，减少拼写和 ID 类型混淆，但不把前端选择器当作授权边界；
- `scope_code` 和描述执行长度、必填及空白校验，最终规则以后端为准；
- 写操作按钮在提交期间禁用，避免重复提交；
- 页面不推断 App/Scope/Grant 级联语义，不 fail open；
- 不输出 Token、Secret 或完整敏感错误载荷；
- 本阶段不新增日志、指标或追踪。

## 4. 实施步骤

1. 创建本阶段计划并重新核对 OpenAPI、Git 和第 1 阶段状态；
2. 实现 Resource Scopes API 类型、函数和映射测试；
3. 实现分页列表、目标应用/状态筛选、空态和错误重试；
4. 实现 Apps 远程选择器、上限提示和依赖失败边界；
5. 实现 Scope 创建和启用/禁用确认；
6. 接入 `/resource-scopes` 导航、路由、最小样式和 README；
7. 补充页面/导航测试并按由窄到宽顺序验证；
8. 创建执行记录并同步总方案和本阶段计划状态。

真实写操作依赖受控管理员凭证、CORS 和单独授权，不由本阶段普通验证自动执行。

## 5. 测试与验证计划

### 5.1 定向测试

| 测试文件/范围                       | 覆盖行为                                               | 预期结果                             |
| ----------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `admin-resource-scopes-api.test.ts` | 四个接口的 path/query/body、业务 App ID、数字 Scope ID | 与 OpenAPI 一致，状态 POST 无 body   |
| `AdminResourceScopesPage.test.tsx`  | 列表、筛选、分页、Apps 候选、上限/错误、创建和状态     | UI 只提交候选业务 ID，失败不误改状态 |
| `App.test.tsx`                      | `/resource-scopes` 导航与菜单数量                      | 五个管理入口均可进入，旧入口继续可用 |

### 5.2 回归与质量检查

```bash
pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-resource-scopes-api.test.ts src/pages/AdminResourceScopesPage.test.tsx src/App.test.tsx
pnpm exec prettier --check apps/app/src/services/admin-resource-scopes-api.ts apps/app/src/services/admin-resource-scopes-api.test.ts apps/app/src/pages/AdminResourceScopesPage.tsx apps/app/src/pages/AdminResourceScopesPage.test.tsx apps/app/src/App.tsx apps/app/src/App.test.tsx apps/app/src/styles/main.css README.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_PLAN.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_EXECUTION.md
pnpm lint
pnpm format:check
pnpm test
pnpm build
git diff --check
git status --short
```

仓库 `format:check` 的既有脚本只覆盖指定配置文件，因此本阶段 TypeScript、CSS 和 Markdown 文件另执行 Prettier 检查。

### 5.3 真实环境验证

浏览器无副作用检查可验证 `/resource-scopes` 路由、导航、筛选、列表错误态、Apps 候选提示、创建表单和布局。真实 Apps/Scopes GET 需要可用 CORS 和有效 Token；创建和启停 Scope 有持久副作用，需要受控账号、明确授权及恢复方案。本阶段未经用户额外授权不执行真实写操作，未执行项在执行记录中标为“待环境验证”，不进入普通 CI。

## 6. 验收标准与追踪

| 编号     | 验收标准                                                                   | 实现位置     | 验证方式           | 状态       |
| -------- | -------------------------------------------------------------------------- | ------------ | ------------------ | ---------- |
| AC-2-01  | Scope 列表分页、目标 App 和启用状态筛选映射正确，失败可重试                | Service/Page | API 与页面测试     | 已满足     |
| AC-2-02  | 创建必须从 Apps 选择并提交字符串业务 `target_app_id`，字段校验/规范化正确  | Service/Page | API 与页面测试     | 已满足     |
| AC-2-03  | 启用/禁用使用数字 Scope `id`、无请求体，并正确反馈 `changed`               | Service/Page | API 与页面测试     | 已满足     |
| AC-2-04  | Apps 候选可按关键词检索；超过 100 条提示不完整；失败时可重试且不能手填绕过 | Page         | 组件测试           | 已满足     |
| AC-2-05  | `/resource-scopes` 导航可用，且不包含编辑、删除、Grant 或级联推断          | App/Page     | 导航测试与源码核对 | 已满足     |
| AC-2-06  | 定向、lint、格式、全量测试、构建和 diff 检查通过                           | Workspace    | 质量门禁命令       | 已满足     |
| AC-2-ENV | 真实 API 读取和受控写操作完成                                              | 环境         | 浏览器/人工        | 待环境验证 |

## 7. 风险、回滚与异常处理

| 风险或失败场景         | 影响                        | 预防/检测                          | 回滚或恢复                                  |
| ---------------------- | --------------------------- | ---------------------------------- | ------------------------------------------- |
| Apps 候选超过 100 条   | 目标应用可能不在当前结果    | 显示不完整提示并支持关键词远程查询 | 缩小关键词；后续如仍不足需后端搜索能力      |
| Apps 候选加载失败      | 无法可靠选择目标实体        | 禁止手填，显示错误与重试           | 恢复依赖服务后重试                          |
| 创建成功、列表刷新失败 | 新 Scope 暂未出现在当前列表 | 创建成功与刷新结果分开处理         | 保留成功提示并允许列表重试                  |
| 状态请求失败           | Switch 与服务端不一致       | 不做乐观更新                       | 保留原查询值并重试                          |
| App/Scope 禁用级联未知 | 页面可能误导 Grant 影响     | 不描述或计算级联效果               | 以后端结果和后续契约为准                    |
| 应用代码回滚           | `/resource-scopes` 入口消失 | 无数据迁移                         | 回滚镜像；已创建/变更的服务端数据需人工处理 |

## 8. 阶段交付物

代码与测试：Resource Scopes Service、页面、Apps 候选、导航、样式及对应测试。

文档：

- 更新[总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)的第 2 阶段状态与链接；
- 更新本阶段计划的状态和已确认设计调整；
- 创建[第 2 阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_EXECUTION.md)。

## 9. 计划调整记录

| 调整项           | 原计划                       | 调整后                                      | 原因                                                         | 对总方案/后续阶段的影响                |
| ---------------- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| 创建后的查询失效 | 创建成功后等待列表失效再结束 | 创建成功后立即关闭，异步触发 Scope 查询失效 | 列表刷新失败不应把已成功创建误报为创建失败                   | 强化成功/刷新边界，无接口或范围变化    |
| 非法响应鲁棒性   | 按 OpenAPI 直接读取 `items`  | Apps 候选读取 `items` 时增加可选链          | standalone `/api` 返回非领域 JSON 时浏览器检查出现运行时异常 | 不改变正式契约，避免整页因异常载荷崩溃 |
| 浏览器 API 验证  | 预期 CORS/凭证可能阻塞       | 页面通过；`/api` 响应不是领域 Schema        | 当前 standalone 未配置可用的真实 API 代理                    | 阶段保持部分完成，发布前继续追踪       |

上述调整未引入 Service Grants、Scope 详情/编辑/删除、后端或部署配置。实际结果与证据见[阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_EXECUTION.md)。
