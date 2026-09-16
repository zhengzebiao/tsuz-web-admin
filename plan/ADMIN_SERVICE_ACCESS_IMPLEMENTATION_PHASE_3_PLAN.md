# 管理端服务访问管理：第 3 阶段“服务授权管理”实现计划

> 状态：部分完成；代码、本地质量门禁和浏览器无副作用检查已完成，真实 API 读写联调待执行
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[第 3 阶段“服务授权管理”执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_EXECUTION.md)
>
> 范围：接入 `admin-service-grants` 列表、caller/target/Scope 联动创建、有效期和撤销；不实现 Grant 编辑、删除、恢复、批量授权或 Secret 管理。

## 1. 背景与阶段基准

### 1.1 前置阶段状态

第 1 阶段“应用管理”和第 2 阶段“资源范围管理”的代码、本地质量门禁及浏览器无副作用检查已落地，真实环境读写联调仍因可用 API 代理、管理员凭证和写操作授权待执行。上述环境遗留不阻塞本阶段前端实现与 Mock 验证。本阶段可直接复用：

- [`apps/app/src/services/admin-apps-api.ts`](../apps/app/src/services/admin-apps-api.ts) 的 `listAdminApps`、`AdminApp` 和字符串业务 `app_id`；
- [`apps/app/src/services/admin-resource-scopes-api.ts`](../apps/app/src/services/admin-resource-scopes-api.ts) 的 `listAdminResourceScopes`、`AdminResourceScope` 和数字 Scope `id`；
- [`apps/app/src/services/api-client.ts`](../apps/app/src/services/api-client.ts) 的 API 基地址、Bearer Token 和 401 logout 处理；
- [`apps/app/src/pages/AdminResourceScopesPage.tsx`](../apps/app/src/pages/AdminResourceScopesPage.tsx) 的 Apps 远程候选、100 条上限提示、依赖失败重试和非乐观写操作模式；
- [`apps/app/src/pages/AdminAppsPage.tsx`](../apps/app/src/pages/AdminAppsPage.tsx) 的分页筛选、表单 Modal 和 `changed` 幂等反馈；
- TanStack Query、Ant Design、`PageContainer` 和共享管理页样式。

前置阶段详情及遗留项见[第 1 阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)和[第 2 阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_EXECUTION.md)。

### 1.2 当前仓库事实

- 实施前 Git 工作区干净，当前分支为 `feat/admin-apps-phase-1`，Apps 与 Resource Scopes 已位于当前 `HEAD`；
- 依赖已安装，本阶段无需新增依赖、配置或锁文件变化；
- 当前导航包含 `/users`、`/roles`、`/permissions`、`/apps`、`/resource-scopes`，尚无 Service Grants 入口；
- 2026-09-16 本地 `http://127.0.0.1:8000/openapi.json` 未运行，不能作为本次直接读取来源；
- 本次改从相邻后端仓库 `tsuz-api-main` 当前 `main` 提交 `cc05c66` 生成 OpenAPI，并核对 `app/api/admin_service_grants.py`、`app/schemas/service_authorization.py`、`app/services/app_service_grant_service.py` 和 `tests/test_service_authorization_api.py`；后端工作区只有与本功能无关的未跟踪文档；
- Service Grants 契约自引入提交 `4805eab` 至当前没有相关代码差异，路径和 Schema 与总方案一致；
- 列表最大 `page_size` 为 100，支持 `caller_app_id`、`target_app_id` 和 `status=enabled|revoked`；
- 创建只接受字符串 `caller_app_id`、正整数 `scope_id`、可选 `valid_from` 和 `expires_at`；UI 临时 `target_app_id` 不是创建请求字段；
- 撤销使用数字 Grant `id`，请求体中的可选 `reason` 最长 500 字符；响应包含 `changed`；
- 响应包含 `target_app_id`、`scope_code`、有效期和创建/撤销审计字段；Grant 服务端状态只有 `enabled` 与 `revoked`；
- 后端 Pydantic 校验明确拒绝带时区的创建时间，要求 UTC 无时区 datetime；这比总方案中“提交 ISO 8601”的描述更具体，本阶段按后端真实契约转换并同步文档。

除时间格式需要按当前后端事实细化外，当前代码与总方案没有业务范围冲突。前两阶段真实环境联调尚未完成的事实继续保留，不将其改写为已通过。

### 1.3 本阶段目标

1. 在 `/service-grants` 提供可测试的授权列表、筛选、受约束创建和撤销管理；
2. 正确区分字符串 caller/target 业务 `app_id`、数字 Scope `id` 和数字 Grant `id`，严格映射三个纳入范围的接口；
3. 通过 caller/target Apps 与目标 App 下启用 Scope 的联动选择约束输入，并明确暴露依赖失败和 100 条候选上限；
4. 正确校验有效期，并将本地选择时间转换为后端要求的 UTC 无时区 ISO datetime；
5. 已撤销项保持只读，所有状态以服务端响应为准，不做乐观更新或前端状态推导；
6. 保持现有管理模块、认证、qiankun/standalone 和查询缓存契约不变，补齐测试及三类实施文档。

## 2. 范围与约束

### 2.1 本阶段实现

- Grant caller App、target App、服务端状态筛选，20 条服务端分页、空态、失败和重试；
- 使用 Apps 可搜索下拉选择 caller 与 target，不允许自由文本绕过既有实体；
- 按 target App 加载 `is_enabled: true` 的 Scope，使用数字 `scope_id` 创建 Grant；
- 可选生效/到期时间、时间顺序校验及 UTC 无时区请求转换；
- Grant 撤销原因表单和 `changed` 幂等反馈；
- `/service-grants` 导航和路由；
- API、页面、导航测试；
- 总方案、本阶段计划和执行记录同步。

### 2.2 本阶段明确不实现

- Grant 编辑、删除、恢复、批量授权、导入导出或独立审计日志页面；
- Apps Secret 重新生成或其他 Secret 管理；
- App/Scope 禁用、Grant 有效期与服务端授权效果之间的前端级联或派生状态；
- Scope 搜索、分页或后端 API 增强；
- 后端、数据库、部署配置、权限策略或公共契约改造；
- 未经明确授权的真实环境 Grant 创建或撤销操作。

### 2.3 已确认约束

- caller 与 target 都必须来自 Apps 候选，提交 Apps 响应中的字符串业务 `app_id`，不得提交 Apps 数字记录 `id`；
- target 只用于筛选 Scope，不进入 Grant 创建请求；
- Scope 只加载所选 target 下 `is_enabled: true` 的第一页 100 条，并提交数字 Scope `id`；
- Apps 与 Scopes 候选超过 100 条时必须提示结果不完整，不得宣称全量；Scope API 不支持搜索时不提供伪搜索或自由文本旁路；
- 禁用 App 可标注但不在前端擅自禁止选择，最终约束以后端为准；
- `valid_from` 与 `expires_at` 可空；填写到期时间时必须晚于填写的生效时间，否则晚于提交时当前时间；
- 管理员按浏览器本地时间选择，提交时转换为 UTC 并移除时区标记，形成后端接受的 UTC 无时区 ISO datetime；服务端返回的无时区时间按 UTC 解释后以浏览器本地时区展示；
- 创建请求只包含 `caller_app_id`、`scope_id` 和已填写的有效期字段；
- 撤销 `reason` 最长 500 字符，去除首尾空白后空值发送 `null`；
- Grant 状态直接展示服务端 `enabled`/`revoked`，不根据有效期推导“未生效”或“已过期”等新状态；
- 仅 `enabled` 项提供撤销，`revoked` 项只读；不提供恢复、编辑或删除；
- 所有写操作不做乐观更新，成功后失效 Grant 查询；`changed: false` 必须反馈幂等无变化。

### 2.4 临时数据与隔离测试规则

- API 和页面自动化测试全部使用 Mock，不访问长期保留的开发、测试或生产 API；
- 测试使用固定非生产 App ID、Scope 和 Grant，不保存 Token、Secret 或生产敏感数据；
- 本阶段不涉及 PostgreSQL、Redis、迁移或临时基础设施；
- 浏览器检查只执行导航、表单和错误边界等无副作用操作，不确认最终创建或撤销；
- 如后续获授权执行真实联调，需使用受控测试 App/Scope/Grant、管理员账号及明确数据清理方案，并单独记录副作用；
- 本阶段不执行生产数据库、生产缓存、生产迁移或部署操作。

### 2.5 前置依赖与环境条件

| 依赖                         | 所需状态                                  | 当前状态                               | 不满足时的处理                                   |
| ---------------------------- | ----------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| Apps 前端查询能力            | `listAdminApps` 和业务 `app_id` 已落地    | 已满足；第 1 阶段代码在当前分支        | 契约漂移则暂停写操作并更新计划                   |
| Resource Scopes 前端查询能力 | 可按 target 和启用状态查询数字 Scope `id` | 已满足；第 2 阶段代码在当前分支        | 依赖失败时 fail closed，不允许手填               |
| Service Grants OpenAPI       | 路径和 Schema 可核对                      | 已满足；从后端源码生成并与历史契约核对 | 契约变化则按信息优先级处理并记录差异             |
| 前端依赖                     | 已安装且可运行测试                        | 已满足                                 | 报告环境阻塞，不跳过质量门禁                     |
| 真实 API/管理员凭证          | 仅真实联调需要                            | 未满足/未授权                          | 只执行 Mock 和无副作用浏览器检查，标记待环境验证 |

## 3. 详细设计与修改文件

### 3.1 Service Grants API Service

新增：

- `apps/app/src/services/admin-service-grants-api.ts`：OpenAPI 类型和列表、创建、撤销三个请求函数；
- `apps/app/src/services/admin-service-grants-api.test.ts`：路径、方法、query、body、ID 类型、字段白名单和原因规范化测试。

设计：

1. 列表空 caller/target 映射为 `undefined`，`status` 按 `enabled|revoked` 原样传递；
2. 创建函数重建字段白名单请求体，只发送 caller、Scope 和已提供的有效期字段，即使调用方对象运行时含临时 target 也不会透传；
3. 撤销接收数字 Grant 记录 ID，原因 trim 后空值规范化为 `null`；
4. Service 只映射后端契约，不负责 Apps/Scopes 联动、时间控件、编辑/删除/恢复或状态推导。

### 3.2 服务授权列表与筛选

新增：

- `apps/app/src/pages/AdminServiceGrantsPage.tsx`：列表、筛选、分页、创建联动、有效期和撤销；
- `apps/app/src/pages/AdminServiceGrantsPage.test.tsx`：查询、依赖上限/失败、创建时间、撤销和只读边界测试。

设计：

- Grant 列表 query key 包含页码和已应用筛选，根 key 为 `admin-service-grants`；
- 筛选提供 caller App、target App 和状态，Apps 候选使用 `listAdminApps(page=1, page_size=100, keyword)`；
- 表格展示数字 Grant ID、caller/target 业务 App ID、Scope Code/数字 ID、服务端状态、有效期、创建和撤销审计信息；
- 服务端状态 `enabled` 显示“已启用”，`revoked` 显示“已撤销”；这里只翻译枚举文案，不推导时间效果；
- 列表异常显示失败状态和重试入口，异常载荷不导致整页崩溃；
- 分页、筛选和重置沿用现有管理页面模式。

### 3.3 caller/target/Scope 联动创建

设计：

1. caller 与 target 使用独立可搜索 Apps 选择器，值始终是字符串业务 `app_id`；
2. Apps 搜索输入 250ms 防抖，选中项即使不在新结果中也保留标签；禁用 App 只标记；
3. 选择 target 后请求 `GET /admin/resource-scopes?page=1&page_size=100&target_app_id=...&is_enabled=true`；
4. target 改变立即清空旧 `scope_id`，避免跨目标 Scope 错配；
5. 未选择 target、Scope 加载失败或没有候选时不能通过自由文本绕过；加载失败提供重试；
6. Apps/Scopes `total > items.length` 时分别提示当前 100 条结果不完整；
7. Scope 选项展示 `scope_code` 和数字记录 ID，提交只使用数字 ID；
8. 创建成功根据 `changed` 显示真实反馈，关闭 Modal 并异步失效 Grant 查询；创建失败保留 Modal 和表单状态。

### 3.4 有效期与时间契约

- 使用 Ant Design 已内置的 `DatePicker` 和时间选择能力，不直接新增 `dayjs` 顶层依赖；
- `valid_from` 和 `expires_at` 都可空；
- 到期时间必须晚于所选生效时间；生效时间为空时，到期时间必须晚于当前时间；
- 控件值按本地时间显示，提交时通过绝对时间值转换为 `Date#toISOString()`，再去掉尾部 `Z`，得到 UTC 无时区字符串；
- 服务端返回时间若没有 `Z` 或数字时区后缀，则补 `Z` 后按 UTC 解析，再以浏览器本地时区展示；
- 前端校验仅拦截明显无效时间窗，最终业务规则以后端为准。

### 3.5 撤销与只读边界

- 仅服务端状态为 `enabled` 的行显示撤销按钮；
- 撤销 Modal 使用独立表单，可填写最多 500 字符原因；
- 请求失败时保持 Modal、原因和列表原状态；
- 成功时根据 `changed` 区分实际撤销与幂等无变化，再失效 Grant 查询；
- `revoked` 行仅显示只读状态，不提供恢复、编辑、删除或其他写入口。

### 3.6 导航、样式和说明

修改：

- `apps/app/src/App.tsx`：增加“服务授权管理”和 `/service-grants`；
- `apps/app/src/App.test.tsx`：增加导航覆盖并把菜单数量更新为 6；
- `apps/app/src/styles/main.css`：将 Grants 分页类加入既有居中规则；
- `README.md`：更新测试覆盖、项目结构和当前导航说明。

页面继续使用既有管理页 Table、筛选、Modal 和共享样式，不进行无关重构或视觉改版。

### 3.7 数据、迁移或状态

不涉及数据结构、数据库、缓存、队列或迁移。页面局部状态包括：

- Grant 已应用筛选、筛选草稿和页码；
- Apps 远程搜索词、当前成功加载的候选标签和 100 条上限状态；
- 创建 target 到启用 Scope 的候选查询；
- 创建/撤销 Modal、表单和写操作加载状态。

关闭 Modal 后表单组件卸载；不把表单或审计数据写入 Store、Storage 或 URL。

### 3.8 API、Schema 或公共契约

本阶段不改变后端或 workspace 公共契约，只消费：

- `GET /admin/service-grants?page&page_size&caller_app_id&target_app_id&status`；
- `POST /admin/service-grants`；
- `POST /admin/service-grants/{grant_id}/revoke`。

关键请求与响应：

```text
Create = {
  caller_app_id,
  scope_id,
  valid_from?,  // UTC 无时区 ISO datetime
  expires_at?   // UTC 无时区 ISO datetime
}

Grant = {
  id, caller_app_id, scope_id, target_app_id, scope_code,
  status, valid_from, expires_at,
  created_by, created_at, revoked_by, revoked_at, revoke_reason
}

ActionResponse = Grant + { changed }
```

### 3.9 配置、依赖和外部服务

- 不新增配置、环境变量、顶层依赖或锁文件变化；
- 复用现有 API Client、Apps Service 和 Resource Scopes Service；
- OpenAPI 读取来源不进入应用运行配置；
- TanStack Query 继续沿用全局重试和 30 秒 `staleTime`；
- 自动测试不发起真实 HTTP 写请求。

### 3.10 安全、权限与可观测性

- 后端 Bearer 权限为最终授权边界，前端不绕过 401/403；
- caller、target 和 Scope 只能从后端候选选择，减少拼写和 ID 类型混淆，但选择器不作为授权边界；
- 字段白名单确保临时 target 不进入创建请求；
- 有效期、状态和级联效果最终以后端为准，不 fail open；
- 写操作按钮在提交期间禁用，避免重复提交；
- 不输出 Token、Secret 或完整敏感错误载荷；
- 本阶段不新增日志、指标或追踪，列表/依赖/写操作失败通过安全错误摘要和重试入口反馈。

## 4. 实施步骤

1. 创建本阶段计划并核对 OpenAPI、后端源码、Git 和前置阶段状态；
2. 实现 Service Grants 类型、请求函数和映射测试；
3. 实现分页列表、caller/target/状态筛选、空态和错误重试；
4. 实现 Apps 远程候选、target 到启用 Scope 联动、上限和依赖失败边界；
5. 实现有效期控件、时间顺序校验和 UTC 无时区转换；
6. 实现 Grant 创建、撤销原因和已撤销只读边界；
7. 接入 `/service-grants` 导航、路由、最小样式和 README；
8. 补充页面/导航测试并按由窄到宽顺序验证；
9. 执行可用的浏览器无副作用检查；
10. 创建执行记录并同步总方案和本阶段计划状态。

真实写操作依赖受控管理员凭证、可用 API 环境和单独授权，不由本阶段普通验证自动执行。

## 5. 测试与验证计划

### 5.1 定向测试

| 测试文件/范围                      | 覆盖行为                                                          | 预期结果                                               |
| ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `admin-service-grants-api.test.ts` | 三个接口的 path/query/body、字段白名单、数字 ID、原因规范化       | 与 OpenAPI 一致，UI 临时 target 不透传                 |
| `AdminServiceGrantsPage.test.tsx`  | 列表筛选分页、Apps/Scopes 联动、上限/错误、时间、创建、撤销和只读 | 只提交业务 caller、数字 Scope 和有效期；失败不误改状态 |
| `App.test.tsx`                     | `/service-grants` 导航与菜单数量                                  | 六个管理入口均可进入，旧入口继续可用                   |

### 5.2 回归与质量检查

```bash
pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-service-grants-api.test.ts src/pages/AdminServiceGrantsPage.test.tsx src/App.test.tsx
pnpm exec prettier --check apps/app/src/services/admin-service-grants-api.ts apps/app/src/services/admin-service-grants-api.test.ts apps/app/src/pages/AdminServiceGrantsPage.tsx apps/app/src/pages/AdminServiceGrantsPage.test.tsx apps/app/src/App.tsx apps/app/src/App.test.tsx apps/app/src/styles/main.css README.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_PLAN.md plan/ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_EXECUTION.md
pnpm lint
pnpm format:check
pnpm test
pnpm build
git diff --check
git status --short
```

仓库 `format:check` 的既有脚本只覆盖指定配置文件，因此本阶段 TypeScript、CSS 和 Markdown 文件另执行 Prettier 检查。无法在当前环境执行的检查必须记录真实原因，不预设为通过。

### 5.3 真实环境验证

浏览器无副作用检查可验证 `/service-grants` 路由、六项导航、筛选、列表错误态、Apps/Scopes 联动提示、时间字段、创建和撤销表单布局。真实 Apps/Scopes/Grants GET 需要可用 API 基地址和有效 Token；Grant 创建和撤销有持久副作用，需要受控账号、明确授权及清理方案。本阶段未经用户额外授权不执行真实写操作，未执行项在执行记录中标为“待环境验证”，不进入普通 CI。

## 6. 验收标准与追踪

| 编号     | 验收标准                                                                           | 实现位置     | 验证方式           | 状态       |
| -------- | ---------------------------------------------------------------------------------- | ------------ | ------------------ | ---------- |
| AC-3-01  | Grant 列表分页、caller/target/服务端状态筛选映射正确，失败可重试                   | Service/Page | API 与页面测试     | 已满足     |
| AC-3-02  | caller/target 必须从 Apps 选择，并按 target 只加载启用 Scope；依赖失败不能手填绕过 | Page         | 组件测试           | 已满足     |
| AC-3-03  | Apps/Scopes 候选超过 100 条明确提示不完整；Apps 支持关键词缩小，Scope 不伪造搜索   | Page         | 组件测试           | 已满足     |
| AC-3-04  | 创建只提交 `caller_app_id`、数字 `scope_id` 和已填写有效期，不携带临时 target      | Service/Page | API 与页面测试     | 已满足     |
| AC-3-05  | 有效期顺序校验正确，本地时间转换为后端要求的 UTC 无时区 datetime                   | Page         | 组件测试与源码核对 | 已满足     |
| AC-3-06  | 撤销使用数字 Grant ID 和 `{ reason }`，正确反馈 `changed`，失败不乐观更新          | Service/Page | API 与页面测试     | 已满足     |
| AC-3-07  | 已撤销项只读；页面不实现编辑、删除、恢复、批量操作或状态推导                       | Page         | 页面测试与源码核对 | 已满足     |
| AC-3-08  | `/service-grants` 导航可用，旧五个入口和公共宿主契约保持兼容                       | App          | 导航与回归测试     | 已满足     |
| AC-3-09  | 定向、lint、格式、全量测试、构建和 diff 检查通过                                   | Workspace    | 质量门禁命令       | 已满足     |
| AC-3-ENV | 真实 API 读取及受控创建/撤销完成                                                   | 环境         | 浏览器/人工        | 待环境验证 |

阶段执行完成后由执行记录填写真实结果；只有本地必需验收项、文档同步和可执行检查全部通过时，才能按项目现有口径标为“部分完成（真实环境待验证）”。

## 7. 风险、回滚与异常处理

| 风险或失败场景                | 影响                           | 预防/检测                             | 回滚或恢复                                  |
| ----------------------------- | ------------------------------ | ------------------------------------- | ------------------------------------------- |
| Apps 候选超过 100 条          | caller/target 可能不在当前结果 | 显示不完整提示并支持关键词远程查询    | 缩小关键词；必要时由后端增强能力            |
| Scope 候选超过 100 条且无搜索 | 目标 Scope 可能不可选          | 明确提示，不宣称全量或允许手填        | 由后端增加搜索/分页能力后再扩展             |
| Apps/Scopes 候选加载失败      | 无法可靠选择实体               | fail closed，显示错误和重试           | 恢复依赖服务后重试                          |
| target 改变保留旧 Scope       | 创建错误授权                   | target 变化立即清空 `scope_id` 并测试 | 重新选择当前 target 的 Scope                |
| 时间时区错误                  | 授权提前/延后生效或请求被拒    | UTC 无时区转换与测试；服务端最终校验  | 修正表单重试；已创建数据按后端能力处理      |
| 创建成功、列表刷新失败        | 新 Grant 暂未出现在列表        | 写成功与查询失效分开处理              | 保留成功提示并允许列表重试                  |
| 撤销请求失败                  | 页面与服务端状态不一致         | 不做乐观更新，失败保留表单            | 保留原查询值并重试                          |
| 已撤销授权无法恢复            | 误操作不可由当前 UI 逆转       | 原因表单、明确撤销动作、服务端审计    | 依据后端业务流程处理，不伪造恢复入口        |
| 应用代码回滚                  | `/service-grants` 入口消失     | 无前端数据迁移                        | 回滚镜像；已创建/撤销的服务端数据需人工处理 |

## 8. 阶段交付物

代码与测试：Service Grants Service、页面、Apps/Scopes 联动、有效期、撤销、导航、样式及对应测试。

文档：

- 更新[总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)的第 3 阶段状态、时间契约和链接；
- 更新本阶段计划的状态和已确认设计调整；
- 创建[第 3 阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_EXECUTION.md)。

## 9. 计划调整记录

| 调整项             | 原计划                      | 调整后                                                                                                                                                             | 原因                                                                                       | 对总方案/后续阶段的影响                                          |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 异常列表载荷鲁棒性 | 按 OpenAPI 直接读取分页响应 | 列表及依赖候选对非数组 `items` 和非数字 `total` 安全降级为空数据                                                                                                   | standalone `/api` 实际返回 Vite HTML，通用 Client 将其作为字符串返回；需避免页面运行时崩溃 | 不改变正式契约；真实环境验证仍待执行                             |
| 全量测试首次结果   | 预期一次通过                | 首次全仓运行 81 个应用测试断言均通过，但出现 3 个来自既有 `AdminRolesPage.test.tsx` 的 teardown 后 `window is not defined`；随后应用全量和全仓全量各重跑一次均通过 | 既有异步清理偶发错误，不由第三阶段断言触发；需要如实保留历史结果                           | 本阶段质量门禁以稳定重跑通过为结论，既有测试清理作为非阻塞维护项 |

上述调整没有扩大到后端、部署、Grant 编辑/删除/恢复、Scope 搜索或真实写操作。实际结果与证据见[阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_EXECUTION.md)。
