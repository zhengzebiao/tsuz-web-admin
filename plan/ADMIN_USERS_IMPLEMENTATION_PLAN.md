# admin-users 用户管理模块实施方案

> 状态：实施中；第一阶段代码和本地质量门禁已完成，真实测试环境写操作待受控联调
>
> 本方案基于当前 React + TypeScript + Ant Design + TanStack Query + qiankun 子应用，以及 `https://test-api.tusz.online/openapi.json` 的 `admin-users` 接口契约。
>
> 相关文档：
> - [实施方案模板](./IMPLEMENTATION_PLAN_TEMPLATE.md)
> - [Swagger UI](https://test-api.tusz.online/docs#/)
> - [OpenAPI JSON](https://test-api.tusz.online/openapi.json)

## 1. 已确认业务配置与关键决策

| 项目 | 决策或配置 | 状态/来源 |
| --- | --- | --- |
| 模块范围 | 接入 `admin-users` 用户列表及用户操作 | 已确认；用户需求 |
| UI 技术 | 使用 Ant Design 的 `Table`、`Switch`、`Modal`、`Form` 等组件 | 已确认；用户需求与现有依赖 |
| 列表状态操作 | `is_active` 使用 Switch；关闭调用禁用接口，打开调用开启接口；`is_blacklisted` 使用 Switch；打开黑名单调用拉黑接口，关闭黑名单调用解禁接口 | 已确认；用户需求 |
| 无参数操作 | 表格操作栏按钮触发二次确认弹窗 | 已确认；用户需求 |
| 有参数操作 | 表格操作栏按钮触发表单弹窗 | 已确认；用户需求 |
| 详情操作 | 表格操作栏按钮触发详情弹窗 | 已确认；用户需求 |
| 创建角色 | 不接入创建角色接口 `POST /admin/roles` | 已确认；用户需求 |
| 角色分配 | 默认接入已有角色选择与用户角色替换接口；不提供创建角色入口 | 合理默认，待确认是否纳入本期 |
| 认证 | 复用 qiankun 传入的 `getAccessToken`、`logout` 和 `apiBaseUrl` | 已确认；当前仓库架构 |
| API 基地址 | 独立运行时使用 `VITE_API_BASE_URL`，默认 `/api`；qiankun 运行时使用宿主传入值 | 已确认；当前仓库架构 |
| 失败处理 | 操作失败保留原状态，展示 Ant Design message/notification，并刷新或回滚列表状态 | 合理默认，待确认 |

## 2. 背景与现状

### 2.1 背景

当前管理员子应用已经有左侧导航和 `/users` 路由，但 `AdminUsersPage` 仍为空页面。需要把测试 API 的用户管理能力接入，使管理员可以查询用户、查看详情、编辑资料、创建用户和维护用户状态。

### 2.2 当前架构

- [`apps/app/src/pages/AdminUsersPage.tsx`](../apps/app/src/pages/AdminUsersPage.tsx)：现为占位页面。
- [`apps/app/src/App.tsx`](../apps/app/src/App.tsx)：已注册 `/users` 路由和用户管理导航。
- [`apps/app/src/services/api-client.ts`](../apps/app/src/services/api-client.ts)：通过 `createApiClient` 注入 API 基地址和 Bearer Token。
- [`apps/app/src/stores/app.store.ts`](../apps/app/src/stores/app.store.ts)：保存宿主传入的 `apiBaseUrl`、认证桥接和当前用户。
- [`apps/app/src/providers/query-client.ts`](../apps/app/src/providers/query-client.ts)：已提供 TanStack Query 客户端，默认 `staleTime` 为 30 秒。
- [`packages/api/src/index.ts`](../packages/api/src/index.ts)：提供 GET/POST/PATCH/PUT/DELETE 请求封装。
- [`packages/ui/src/index.tsx`](../packages/ui/src/index.tsx)：提供 `PageContainer` 等通用页面组件。
- [`apps/app/src/styles/main.css`](../apps/app/src/styles/main.css)：已引入 `antd/dist/reset.css`，并定义当前子应用布局样式。

### 2.3 现状差距

1. 用户页没有 API 类型、查询、分页和筛选状态。
2. API client 工厂已存在，但没有用户领域 API 模块或页面级 client 使用方式。
3. 没有表格、Switch 状态切换、操作弹窗及错误/加载状态。
4. 没有用户模块定向测试。
5. 角色页仍为空；若本期提供角色分配，需复用角色列表 API 作为选项来源，但不实现创建角色。

## 3. 目标与非目标

### 3.1 目标

本期完成：

1. 通过 `GET /admin/users` 展示用户列表，支持关键词、启用状态、黑名单状态筛选及服务端分页。
2. 在表格中用两个 Switch 展示并切换 `is_active`、`is_blacklisted`。
3. 在操作栏提供详情、编辑、重置密码、强制下线及角色分配等操作；按请求体是否有必填参数选择确认弹窗或表单弹窗。
4. 提供创建用户入口，校验邮箱、密码、显示名称和初始启用状态。
5. 复用现有认证和 API client，不破坏 standalone 与 qiankun 两种运行模式。
6. 为请求映射、查询参数、弹窗表单、状态切换成功/失败和分页行为补充测试。

### 3.2 非目标

本期明确不实现：

- `POST /admin/roles` 创建角色接口及创建角色 UI；
- 角色管理页、权限管理页的完整实现；
- 删除用户接口（当前 OpenAPI 未提供）；
- 密码明文回显、服务端真实联调以外的权限策略改造；
- 批量操作、批量导入、导出和审计日志页面（当前需求未要求）。

## 4. 需求与核心流程

### 4.1 参与者和使用场景

| 参与者 | 前置条件 | 操作 | 预期结果 |
| --- | --- | --- | --- |
| 管理员 | 已通过宿主认证并具有 `admin-users` 权限 | 打开用户管理 | 加载筛选条件下的用户列表 |
| 管理员 | 列表中存在用户 | 切换启用/禁用 Switch | 无参数时确认；有原因时填写原因；成功后刷新对应行 |
| 管理员 | 列表中存在用户 | 切换拉黑/解禁 Switch | 拉黑填写原因；解禁二次确认；成功后刷新对应行 |
| 管理员 | 列表中存在用户 | 点击操作栏按钮 | 打开详情、编辑、重置密码、强制下线或角色分配弹窗 |
| 管理员 | 有创建权限 | 点击新增用户 | 填写表单并创建用户，成功后回到列表顶部 |

### 4.2 正常流程

```text
进入 /users
  ↓
读取筛选条件并请求 GET /admin/users
  ↓
Ant Design Table 展示列表和分页
  ↓
点击 Switch 或操作按钮
  ↓
无必填请求参数 → Modal.confirm
有必填请求参数 → Modal + Form
详情 → GET 详情后只读 Modal
  ↓
调用 admin-users API
  ↓
成功 message + 关闭弹窗 + 刷新当前列表
失败 message + 保留原数据/原 Switch 状态
```

### 4.3 异常与边界流程

- 列表请求失败：展示错误状态和“重新加载”按钮，不渲染伪造数据。
- 详情请求失败：保留详情弹窗并展示错误提示，允许关闭和重试。
- 状态切换失败：Switch 回到原值；避免只更新本地状态造成服务端与页面不一致。
- 发生 401：沿用 API client 的 `onUnauthorized` 调用宿主 logout。
- 发生 409 或版本冲突：提示数据已变更，刷新列表；编辑和角色分配始终提交接口返回的最新 `version`。
- 重复点击：使用 mutation loading 禁用当前行操作，避免并发提交。
- 空列表：使用表格空状态，保留筛选和新增入口。
- 当前页最后一条被状态筛选排除：刷新后由接口返回的分页结果决定当前页，不在前端强行拼接数据。
- 日期字段：按浏览器本地时区格式化，原始 ISO 字符串不直接展示给用户。

## 5. 当前架构适配与总体设计

### 5.1 设计原则

- 复用 [`createMfeApiClient`](../apps/app/src/services/api-client.ts) 和 `useAppStore`，不另造认证逻辑。
- 通过 TanStack Query 管理列表查询、详情查询和 mutation，使加载、错误和刷新边界清晰。
- API 字段保持 snake_case 类型映射，组件层只负责展示与交互，不在列定义中散落请求路径。
- Switch 是状态操作入口，但有原因的接口先打开表单，不直接乐观写入状态。
- 所有破坏性或会影响登录态的操作都需要明确确认；密码和原因只在表单提交时传输，不进入日志。

### 5.2 目标架构

```text
AdminUsersPage
  ├── UserFilters / UserTable / UserModals
  ├── useAdminUsersQuery
  └── user-api.ts
        ↓
createMfeApiClient(hostProps)
        ↓
@tsuz/api request wrapper
        ↓
/admin/users API
```

建议新增 `apps/app/src/services/admin-users-api.ts`：集中定义用户响应类型、列表/详情/状态/密码/下线/角色请求函数和路径。页面通过 `useAppStore` 读取 host props，构造 client；query key 至少包含分页和筛选参数。

### 5.3 兼容策略

- 不修改现有路由、qiankun 生命周期和宿主挂载契约。
- 不修改后端 API，不增加数据库迁移。
- `GET /admin/users` 的 `page_size` 控制在 API 允许的 1–100 范围内，默认 20。
- 版本字段原样保存并在 PATCH/PUT 操作中提交；不向后端发送 OpenAPI 未声明的字段。

## 6. 接口与外部契约设计

以下路径均要求 `Authorization: Bearer <access-token>`，由现有 API client 注入。

### 6.1 用户列表

```http
GET /admin/users?page=1&page_size=20&keyword=&is_active=&is_blacklisted=
```

请求参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` | integer，最小 1 | 当前页，默认 1 |
| `page_size` | integer，1–100 | 每页数量，默认 20 |
| `keyword` | string/null | 关键词，最大 320 |
| `is_active` | boolean/null | 启用状态筛选 |
| `is_blacklisted` | boolean/null | 黑名单状态筛选 |

成功响应为 `AdminUserListResponse`：`items`、`total`、`page`、`page_size`。用户项包含 `id`、`email`、`display_name`、`is_active`、`is_blacklisted`、禁用/拉黑原因与时间、密码更新时间、创建/更新时间和 `version`。

### 6.2 创建用户

```http
POST /admin/users
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "display_name": "示例用户",
  "password": "由表单输入",
  "is_active": true
}
```

表单字段：邮箱和密码必填；显示名称最多 128 个字符；`is_active` 默认 true。成功返回 `AdminUserResponse`。

### 6.3 用户详情与资料编辑

```http
GET /admin/users/{user_id}
PATCH /admin/users/{user_id}
Content-Type: application/json
```

PATCH 请求体可包含 `email`、`display_name`，且必须包含当前 `version`。详情弹窗只读展示全部安全字段，不展示密码。

### 6.4 启用/禁用

```http
POST /admin/users/{user_id}/disable
Content-Type: application/json
```

```json
{ "reason": "表单输入的禁用原因" }
```

禁用必须填写 1–500 字符原因，因此 `is_active` Switch 从开到关时先弹出原因表单。

```http
POST /admin/users/{user_id}/enable
```

启用无请求体，`is_active` Switch 从关到开时使用二次确认弹窗。

### 6.5 拉黑/解禁

```http
POST /admin/users/{user_id}/blacklist
Content-Type: application/json
```

```json
{ "reason": "表单输入的拉黑原因" }
```

拉黑必须填写 1–500 字符原因，因此 `is_blacklisted` Switch 从关到开时先弹出原因表单。

```http
POST /admin/users/{user_id}/recover
```

解禁无请求体，`is_blacklisted` Switch 从开到关时使用二次确认弹窗。

### 6.6 重置密码

```http
POST /admin/users/{user_id}/reset-password
Content-Type: application/json
```

请求体为 `{ "new_password": "由表单输入" }`。使用表单弹窗，密码字段使用密码输入控件，不回显旧密码；成功响应包含 `message` 和 `revoked_sessions`。

### 6.7 强制下线

```http
POST /admin/users/{user_id}/force-logout
```

请求体可选且 `reason` 可为空。按“无必填参数”归类为二次确认弹窗；成功后展示接口返回的 `revoked_sessions`。如产品要求强制填写审计原因，再改为原因表单，不改变 API 路径。

### 6.8 用户角色

```http
GET /admin/users/{user_id}/roles
PUT /admin/users/{user_id}/roles
Content-Type: application/json
```

PUT 请求体：`role_ids` 数组和当前 `version`。若纳入本期，操作栏增加“角色”按钮，使用多选表单；角色选项来自 `GET /admin/roles`，不提供创建角色按钮。保存角色可能撤销会话，以接口返回为准。

### 6.9 契约兼容性

OpenAPI 当前没有删除用户接口，也没有独立的启用/禁用字段更新 PATCH 语义，前端不得用 PATCH 替代状态专用接口。接口错误 body 由现有 `ApiError.data` 保留，页面统一转换为用户可读提示；不把后端内部错误详情或密码写入日志。

## 7. 数据模型、迁移与状态设计

### 7.1 数据模型

前端只新增 TypeScript 类型，不新增数据库模型：

```text
AdminUser
├── id: number
├── email: string
├── display_name: string | null
├── is_active: boolean
├── is_blacklisted: boolean
├── disabled_at / blacklisted_at: string | null
├── disabled_reason / blacklisted_reason: string | null
├── password_changed_at: string | null
├── created_at / updated_at: string
└── version: number
```

### 7.2 迁移策略

不适用。本期不修改数据库和后端持久化结构。

### 7.3 缓存、队列或临时状态

使用 TanStack Query 缓存列表和详情，列表 query key 隔离分页及筛选条件。mutation 成功后失效用户列表 query；详情查询可在关闭弹窗后失效。弹窗草稿仅存在组件状态，不写入 localStorage。

### 7.4 事务与并发

后端负责状态变更事务；前端提交详情/角色接口返回的 `version`。mutation 期间禁用当前操作，遇到版本冲突刷新当前行或列表，避免前端覆盖其他管理员的最新修改。

## 8. 模块与服务拆分

### `AdminUsersPage`

- 管理筛选、分页、表格列、弹窗开关和当前用户上下文；
- 不直接拼接重复请求路径；
- 不负责认证 token 获取。

### `admin-users-api.ts`

- 定义用户领域 API 类型和请求函数；
- 统一路径参数编码、请求体字段和列表查询参数；
- 不负责 UI Toast、Modal 或路由。

### `UserFormModal` / `UserDetailModal` / `UserActionModal`

- 分别负责创建/编辑、只读详情和带原因/密码/角色参数的交互；
- 使用 Ant Design Form 的校验和 `onFinish`；
- 不保存密码、不输出敏感字段日志。

### `useAdminUsersQuery` 与 mutation hooks

- 封装列表查询、详情查询和状态 mutation；
- 负责 loading、错误、失效和并发控制；
- 方便 Vitest 对 API 调用次数和参数进行验证。

## 9. 配置、依赖与外部服务

### 9.1 配置

无需新增配置。沿用：

```dotenv
VITE_API_BASE_URL=/api
```

qiankun 模式优先使用宿主传入的 `apiBaseUrl`。

### 9.2 依赖

无需新增依赖。当前 `apps/app/package.json` 已包含 `antd`、`@ant-design/icons`、`@tanstack/react-query` 和 React Testing Library。

### 9.3 外部服务契约

- 测试 API：`https://test-api.tusz.online`；
- OpenAPI 来源：`/openapi.json`；
- 所有 `admin-users` 操作需要 Bearer 认证；
- 真实接口验证需要测试环境 token 和具备相应权限的账号，本方案不记录凭证，也不默认执行有副作用的真实写操作。

## 10. 代码变更清单

### 配置和依赖

- 无计划改动。

### API、Schema 或公共契约

- 新增 `apps/app/src/services/admin-users-api.ts`：用户 API 类型和请求函数。
- 如类型规模影响页面可读性，可新增 `apps/app/src/types/admin-users.ts`；优先保持最小文件数量。

### 服务和领域逻辑

- 修改 `apps/app/src/pages/AdminUsersPage.tsx`：筛选、表格、Switch、操作栏和弹窗。
- 必要时新增 `apps/app/src/pages/admin-users/` 下的表单/详情组件，只有在页面文件明显过长时拆分。

### 模型和迁移

- 无数据库模型和迁移改动。

### 测试和文档

- 新增/修改 `apps/app/src/pages/AdminUsersPage.test.tsx`：表格、筛选、分页、弹窗和 mutation 交互。
- 新增/修改 `apps/app/src/services/admin-users-api.test.ts`：路径、请求方法、query/body 映射。
- 本方案实施完成后创建 `plan/ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md` 和 `plan/ADMIN_USERS_IMPLEMENTATION_PHASE_1_EXECUTION.md`，并回填本总方案的阶段状态。

## 11. 异常处理与可观测性

### 11.1 异常响应或错误契约

| 场景 | 外部结果 | 内部处理 |
| --- | --- | --- |
| 参数校验失败 | API 422 | Form 阻止提交；服务端错误转为字段/全局提示 |
| 未认证 | API 401 | API client 调用宿主 logout |
| 无权限 | API 403 | 展示无权限提示，不重试写操作 |
| 用户不存在 | API 404 | 关闭或清理详情/操作上下文，刷新列表 |
| 版本冲突 | 通常为 API 409 | 提示数据已更新，重新读取用户和列表 |
| 网络/服务失败 | 5xx 或网络异常 | 保留原状态，展示重试提示；不假装成功 |

### 11.2 日志、指标与追踪

前端不新增服务端日志。必要的开发日志只记录 operation、user id 和结果状态，不记录邮箱以外的敏感请求体、密码、Token 或完整错误 payload。真实环境的审计记录由后端负责。

## 12. 安全与权限要求

1. 所有请求复用现有 Bearer token 注入，不能从 URL 或 localStorage 自行读取 token。
2. 密码字段使用 `Input.Password`，提交后清空表单；不在 React Query cache、console 或 message 中显示密码。
3. 原因和邮箱输入交给 Ant Design Form 及后端双重校验，显示服务端错误时避免直接渲染不可信 HTML。
4. 状态 mutation 失败时以服务端状态为准，避免越权或假状态。
5. 角色选项和用户详情均由接口权限控制；前端隐藏按钮只能改善体验，不能作为授权边界。
6. 强制下线、禁用、拉黑和重置密码均使用明确的操作文案，防止误操作。
7. 不在本期实现批量高风险操作、密码生成后自动展示或未经确认的真实写接口验收。

## 13. 测试与验收

### 13.1 单元测试

- 列表 query 参数正确转换，空筛选不发送无意义的 null/空值（或按 API client 约定发送）；
- `disable`、`blacklist` 请求携带 `reason`；`enable`、`recover` 不携带 body；
- reset password、PATCH、角色 PUT 的 body 和 `version` 正确；
- 表单校验覆盖邮箱、必填密码、原因 1–500 字符和角色版本。

### 13.2 集成测试

- mock API 返回分页列表，验证 Table 行、状态标签、分页总数和 loading/error/empty 状态；
- 切换启用/黑名单时验证确认弹窗或原因表单分流；
- mutation 成功后验证列表 query 失效/刷新，失败后验证原 Switch 状态不被错误保留；
- 详情和编辑使用当前用户数据及 version；
- 401 调用宿主 logout。

### 13.3 API 或端到端测试

- 需要在测试环境使用受控管理员账号验证：列表、详情、创建、编辑、启用/禁用、拉黑/解禁、重置密码和强制下线。
- 若角色分配纳入本期，额外验证角色列表、用户角色读取和替换。
- 真实接口写操作不在未获得明确授权时执行。

### 13.4 阶段外真实验证

- 测试环境 CORS、API base URL 和 Bearer token 由部署/宿主环境确认。
- 生产环境发布、真实账号写操作、密码重置和强制下线均属于发布前受控验证，不计入本地测试通过。

## 14. 部署、迁移与回滚检查清单

### 配置与 Secret

- [ ] standalone 和 qiankun 两种模式的 API base URL 已验证；
- [ ] token 由宿主安全注入；
- [ ] 构建和浏览器日志无密码、Token、原因完整内容泄露。

### 数据与基础设施

- [x] 本期无数据库迁移；
- [ ] 测试 API 的 `admin-users` 权限已由环境管理员确认；
- [ ] 写操作使用受控测试账号验证。

### 应用与兼容性

- [x] `pnpm lint` 通过；
- [x] `pnpm format:check` 通过；
- [x] `pnpm test` 通过；
- [x] `pnpm build` 通过；
- [x] 现有三项导航测试通过；
- [ ] 测试 API 真实写操作完成受控联调。

### 回滚策略

本期无数据迁移，回滚应用镜像或回退代码即可。若已执行测试环境写操作，按测试账号和后端接口语义人工恢复状态；不得把前端回滚当作数据回滚。

## 15. 分阶段实施顺序

本模块分为 2 个阶段，先完成核心用户管理，再根据确认结果补齐角色分配和真实环境验收。

### 第一阶段：核心用户列表与用户操作

> 状态：部分完成；本地代码和质量门禁已完成，真实测试环境写操作待受控联调
>
> 阶段计划：[ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 执行记录：[ADMIN_USERS_IMPLEMENTATION_PHASE_1_EXECUTION.md](./ADMIN_USERS_IMPLEMENTATION_PHASE_1_EXECUTION.md)

前置依赖：

- 确认 API 测试环境可访问，并由宿主提供有效认证；
- 确认本方案的 Switch 与弹窗交互；
- 确认用户表格展示字段和操作按钮排序。

开发内容：

1. 接入列表、创建、详情、编辑、启用/禁用、拉黑/解禁、重置密码、强制下线接口；
2. 实现 Table、筛选、分页、两个 Switch 和操作栏弹窗；
3. 补充定向测试、质量门禁及阶段计划/执行记录。

本阶段不实现：

- 创建角色接口和创建角色 UI；
- 批量操作、导入导出；
- 角色分配（除非确认作为核心用户操作一起纳入；默认放在第二阶段）。

阶段验收：

- 列表可查询和分页；
- 四种状态切换按参数规则弹出确认/表单并调用正确接口；
- 详情、编辑、创建、重置密码、强制下线行为可测试；
- 写操作失败不会造成错误的本地状态；
- lint、format、test、build 通过。

### 第二阶段：角色分配与受控环境验收

> 状态：待确认
>
> 阶段计划：待创建
>
> 执行记录：待创建

前置依赖：

- 确认本期确实需要在用户表格操作栏维护角色；
- 角色列表接口 `GET /admin/roles` 可用，并明确角色权限展示策略。

开发内容：

1. 接入用户角色读取和替换接口；
2. 在操作栏增加角色分配表单，不提供创建角色入口；
3. 执行测试环境受控联调，并记录接口权限、版本冲突和会话撤销行为。

本阶段不实现：

- 创建角色、角色编辑、角色删除；
- 角色/权限管理页面完整功能。

阶段验收：

- 可查看和替换用户角色，正确提交 `role_ids` 与 `version`；
- 角色分配成功/失败和会话撤销反馈清晰；
- 测试环境联调证据写入执行记录。

## 16. 风险、待确认项与决策记录

### 16.1 风险

| 风险 | 影响 | 缓解措施 | 状态 |
| --- | --- | --- | --- |
| 状态操作需要原因，直接切换会丢失必填参数 | 状态切换无法提交或误导用户 | 禁用/拉黑先开 Form；启用/解禁走确认 | 已缓解 |
| API 的 force-logout body 可选 | 确认弹窗和原因表单存在产品语义差异 | 默认按无必填参数走确认，并将其记录为待确认项 | 开放 |
| API 版本字段导致并发冲突 | 管理员覆盖他人修改 | 提交 version，409 后刷新并提示 | 已缓解 |
| qiankun 宿主未提供 token 或 base URL | 列表请求 401/请求地址错误 | 沿用现有桥接并增加错误态；联调时验证宿主 props | 开放 |
| 后端列表数据字段与文档漂移 | 表格字段解析异常 | API 类型集中管理，先执行 OpenAPI 契约检查和 mock 测试 | 开放 |

### 16.2 待确认项

| 问题 | 为什么需要确认 | 建议默认值 | 负责人/状态 |
| --- | --- | --- | --- |
| 角色分配是否纳入本期 | 决定是否接入角色列表和 PUT roles | 放在第二阶段 | 待用户确认 |
| 强制下线是否需要填写原因 | 决定确认弹窗还是表单 | 因 API body 非必填，默认确认弹窗 | 待用户确认 |
| 表格是否展示全部时间/原因字段 | 影响表格宽度和详情内容 | 表格展示核心字段，原因/时间放详情 | 待确认 |
| 编辑入口是否提供 | PATCH 已存在且属于用户模块 | 提供“编辑”按钮 | 待确认 |

### 16.3 方案决策记录

| 决策 | 原因 | 替代方案 | 确认来源 |
| --- | --- | --- | --- |
| 有必填 body 的动作先弹表单 | 禁用、拉黑、重置密码需要用户输入 | 直接调用会导致 422 或缺少业务原因 | 用户需求 + OpenAPI |
| 无必填 body 的动作使用确认弹窗 | 开启、解禁、强制下线不要求必填字段 | 所有动作都使用表单会增加操作成本 | 用户需求 + OpenAPI |
| 状态 mutation 成功后刷新查询 | 后端响应可能更新 version、时间和会话撤销数 | 只修改当前行容易遗漏服务端字段 | 当前架构与并发要求 |
| 创建角色接口不纳入本期 | 用户明确要求忽略 | 在用户角色表单中提供创建角色快捷入口 | 用户需求 |

## 17. 完成标准

```text
管理员进入用户管理
  ↓
带认证请求用户列表
  ↓
Ant Design Table 展示分页用户
  ↓
状态 Switch / 操作按钮触发确认或参数表单
  ↓
调用对应 admin-users 接口并处理 version
  ↓
成功刷新列表、失败恢复原状态并提示
```

方案整体完成至少要求：

- 第一阶段的所有验收标准有代码和测试证据；
- 未接入创建角色接口，且没有意外新增后端契约；
- 认证、密码、原因和错误处理符合安全要求；
- 相关 lint、format、test、build 结果真实记录；
- 总方案、阶段计划和阶段执行记录状态一致；
- 真实测试环境写操作单独记录，不把未执行的生产/外部验证标记为通过。
