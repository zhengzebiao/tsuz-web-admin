# 管理端服务访问管理：第 2 阶段“资源范围管理”执行记录

> 状态：部分完成；代码、本地质量门禁和浏览器无副作用检查已完成，真实 API 读写联调待执行
>
> 执行日期：2026-09-16
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[第 2 阶段“资源范围管理”实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_PLAN.md)

## 1. 执行范围与结论

本次根据总方案完成第 2 阶段“资源范围管理”的代码、自动化测试、浏览器无副作用检查和文档同步。

阶段结论：Resource Scopes 的列表、目标应用筛选、创建、启用/禁用及 Apps 候选上限/失败反馈已经落地，本地质量门禁全部通过；浏览器中的新路由、导航、筛选、表格和创建表单通过检查。当前 standalone 默认 `/api` 未配置真实后端代理，浏览器取得的 `/api/admin/apps` 和 `/api/admin/resource-scopes` 响应不是有效领域载荷；同时未提供受控管理员凭证或写操作授权，因此真实 API 读取和写操作仍待环境验收，阶段状态为“部分完成”。

本阶段实际完成：

1. 新增 Resource Scopes API 类型和四个纳入范围的请求函数，正确区分字符串业务 `target_app_id` 与数字 Scope `id`；
2. 新增 `/resource-scopes` 页面、导航和路由，实现分页、目标应用/状态筛选、创建、启用/禁用及列表失败重试；
3. 复用 Apps Service 实现最多 100 条的关键词远程候选，提交业务 `app_id`，并对结果不完整和依赖加载失败提供明确提示；
4. 状态操作统一二次确认、不做乐观更新，并根据响应 `changed` 区分实际变化和幂等无变化；
5. 补充 API、页面和导航测试，并完成 lint、格式、全量测试、构建、diff 检查与浏览器无副作用检查；
6. 同步 README、总方案、本阶段计划和本执行记录。

本阶段明确未实现或未执行：

- 未实现 Service Grants、Scope 详情、编辑、删除、批量操作或状态级联推断；
- 未执行真实 Scope 创建、启用或禁用请求；
- 未完成真实 Apps/Scopes 列表读取：当前 standalone `/api` 没有指向可用的真实 API 响应；
- 未执行部署、生产检查或后端改造。

## 2. 实际代码与配置变更

### 2.1 Resource Scopes API 契约

- [`apps/app/src/services/admin-resource-scopes-api.ts`](../apps/app/src/services/admin-resource-scopes-api.ts)：新增 `AdminResourceScope`、分页/创建/动作响应类型，以及列表、创建、禁用、启用请求；
- [`apps/app/src/services/admin-resource-scopes-api.test.ts`](../apps/app/src/services/admin-resource-scopes-api.test.ts)：覆盖分页筛选、空目标 ID、布尔 `false`、创建业务 App ID、数字 Scope ID 和状态 POST 无 body。

关键实现：

```text
GET /admin/resource-scopes?page&page_size&target_app_id&is_enabled
POST /admin/resource-scopes → target_app_id + scope_code + description
POST /admin/resource-scopes/{数字 Scope id}/disable → 无 body
POST /admin/resource-scopes/{数字 Scope id}/enable → 无 body
```

Service 中没有详情、编辑、删除或 Service Grants 能力。

### 2.2 资源范围管理页面

- [`apps/app/src/pages/AdminResourceScopesPage.tsx`](../apps/app/src/pages/AdminResourceScopesPage.tsx)：新增 Scope 分页表格、筛选、失败重试、创建表单、Apps 远程候选及启用/禁用确认；
- [`apps/app/src/pages/AdminResourceScopesPage.test.tsx`](../apps/app/src/pages/AdminResourceScopesPage.test.tsx)：覆盖分页筛选、业务 App ID 提交、字段规范化、状态失败不乐观更新、候选上限和依赖重试。

关键行为：

```text
输入 Apps 关键词
  ↓ 250 ms 防抖
GET /admin/apps?page=1&page_size=100&keyword=...
  ↓
选择 name（业务 app_id）
  ↓
创建只提交 target_app_id + scope_code + description
  ↓
成功后关闭 Modal 并失效 admin-resource-scopes 查询
```

- Apps 选项 query key 归入 `admin-apps` 前缀，可随第 1 阶段 Apps 查询统一失效；
- 候选超过 100 条时提示当前结果不完整并引导缩小关键词；加载失败时提供重试，不回退为自由文本；
- 禁用 App 在候选标签中标记，但未在前端增加 OpenAPI 和总方案未规定的禁选规则；
- `scope_code` 和 `description` 提交前去除首尾空白，空描述发送空字符串；
- Switch 由服务端查询值控制；启用和禁用均二次确认，失败时保留原状态；
- 为浏览器中异常但符合 TypeScript 声明之外的无效响应补充可选链保护，页面不因 `items` 缺失崩溃。

### 2.3 路由、导航、样式和说明

- [`apps/app/src/App.tsx`](../apps/app/src/App.tsx)：新增“资源范围管理”菜单和 `/resource-scopes` 路由；
- [`apps/app/src/App.test.tsx`](../apps/app/src/App.test.tsx)：导航覆盖扩展为 users、roles、permissions、apps、resource-scopes 五项；
- [`apps/app/src/styles/main.css`](../apps/app/src/styles/main.css)：加入 Resource Scopes 分页居中规则；
- [`README.md`](../README.md)：更新测试覆盖、项目结构和当前五项导航说明。

### 2.4 数据、迁移和状态

不涉及数据库、缓存、队列、迁移或持久状态变更。筛选、页码、候选搜索词和创建表单均为页面局部状态；本次没有产生真实 Scope 或其他服务端业务数据。

### 2.5 API、Schema 或公共契约

本阶段未改变后端或 workspace 公共契约，只新增前端领域类型与调用封装。现有 `MicroAppProps`、API 基地址、Bearer Token 注入和 401 logout 行为保持不变。

### 2.6 配置、依赖和外部服务

- 未新增配置、依赖或锁文件变化；
- 浏览器检查使用既有 standalone 默认 `/api`，没有修改或写入环境配置；
- 浏览器请求到 `/api/admin/apps` 和 `/api/admin/resource-scopes`，但返回的载荷不符合领域列表 Schema，因此不能作为真实 API 读取通过证据；
- 没有调用任何真实 POST 状态或创建接口；
- 没有记录真实 Token、Secret 或生产数据。

## 3. 关键设计结果

1. Scope 创建和筛选使用 Apps 响应中的字符串业务 `app_id`，状态接口使用 Scope 数字 `id`；
2. Apps 候选使用第一页 100 条加关键词远程搜索，`total > items.length` 时明确暴露不完整状态；
3. 候选依赖失败时 fail closed：页面提供重试，不提供手填绕过；
4. Scope 写操作不做乐观更新，成功后失效 `admin-resource-scopes` 查询，`changed: false` 显示“操作未发生变化”；
5. 后续 Service Grants 阶段可直接复用 `listAdminResourceScopes` 按目标 App 和启用状态加载 Scope，但本阶段没有提前实现 Grant 逻辑。

## 4. 与阶段计划的差异

| 差异                 | 计划内容                            | 实际实施                                                      | 原因                                                           | 影响与处理                               |
| -------------------- | ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| 创建成功后的列表刷新 | 创建成功后关闭并等待 Scope 查询失效 | 创建成功后立即关闭，异步触发查询失效                          | 列表刷新失败不应把已成功创建误报为创建失败或重新打开表单       | 保留真实创建成功语义，列表可独立重试     |
| 浏览器真实读取       | 预期可能因 CORS/凭证阻塞            | standalone `/api` 返回 200/304，但载荷不是 Apps/Scopes Schema | 当前开发服务没有可用的真实 API 代理；HTTP 状态不能替代契约验证 | 标记待环境验证，并补充无效载荷可选链保护 |
| 浏览器鲁棒性         | 页面按 OpenAPI 响应读取 `items`     | 对 `items` 缺失增加可选链                                     | 无效 `/api` 响应在初次检查中触发运行时异常                     | 不改变正式契约，避免异常响应导致整页崩溃 |

上述调整没有扩大到 Service Grants、Scope 编辑/删除、后端或部署配置。

## 5. 测试与验证结果

### 5.1 验证汇总

| 检查               | 命令或方法                                                                                                                                                  | 结果                           | 证据/说明                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| 定向测试           | `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-resource-scopes-api.test.ts src/pages/AdminResourceScopesPage.test.tsx src/App.test.tsx` | 通过                           | 3 files，16 tests                                                     |
| Lint/类型          | `pnpm lint`                                                                                                                                                 | 通过                           | 4 个 workspace package 均通过 TypeScript no-emit 检查                 |
| 新增/修改文件格式  | `pnpm exec prettier --check ...`                                                                                                                            | 通过                           | 本阶段 TypeScript、CSS 和 Markdown 文件全部匹配                       |
| 仓库格式门禁       | `pnpm format:check`                                                                                                                                         | 通过                           | 仓库脚本覆盖的配置文件全部匹配                                        |
| 全量测试           | `pnpm test`                                                                                                                                                 | 通过                           | App 17 files / 62 tests；API 3 tests；Shared 3 tests；UI 无已配置测试 |
| 构建               | `pnpm build`                                                                                                                                                | 通过                           | Vite 成功构建；存在单 chunk 超过 500 kB 的非阻塞警告                  |
| Diff 检查          | `git diff --check`                                                                                                                                          | 通过                           | 无空白错误                                                            |
| 浏览器无副作用检查 | DevTools 打开 `http://127.0.0.1:7201/resource-scopes`                                                                                                       | 通过（页面）/待环境验证（API） | 五项导航、页面、筛选、表头、空态和创建表单通过；真实领域数据未取得    |

### 5.2 失败与未执行项

- 初次浏览器检查发现 `/api` 返回的非领域 JSON 导致 Apps 候选对 `items` 直接读取时报错；增加可选链后页面保持可用，该问题已修复并重新验证；
- 浏览器真实列表读取未通过：当前 standalone `/api` 没有返回 Apps/Scopes OpenAPI 对应的分页 Schema；
- 未执行真实创建、启用和禁用：缺少受控认证、写操作授权和测试数据恢复方案；
- 全量测试仍输出既有 users/roles/permissions 的 Ant Design `Spin tip`/未连接 Form warning；本阶段新增页面定向测试没有未处理错误，所有测试通过；
- 构建存在仓库既有的大 chunk 非阻塞 warning，本阶段未引入代码拆分改造；
- 浏览器控制台存在开发页面的 Quirks Mode、favicon 404 和 Form label issue；不影响本阶段路由与核心交互，未扩大范围修改基础 HTML 或 Ant Design 内部标记。

### 5.3 真实环境或人工验证

| 验证项                        | 环境              | 副作用/授权            | 结果                                                          |
| ----------------------------- | ----------------- | ---------------------- | ------------------------------------------------------------- |
| `/resource-scopes` 路由和布局 | 本地 Vite `7201`  | 无写副作用             | 通过；五项导航、筛选、表格、空态、创建 Modal 可见且布局正常   |
| Apps/Scopes GET               | standalone `/api` | 只读                   | 待环境验证；当前响应不是领域分页 Schema，不能视为真实接口通过 |
| 创建表单字段                  | 本地 Vite         | 只打开弹窗，不提交     | 通过；字段为目标 App、Scope Code、可选描述                    |
| Scope 写操作                  | 未执行            | 需要受控账号与明确授权 | 未执行；未点击创建或状态确认的最终提交                        |

## 6. 阶段验收结果

| 编号     | 验收标准                                                                   | 结果              | 验证证据                                                                |
| -------- | -------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| AC-2-01  | Scope 列表分页、目标 App 和启用状态筛选映射正确，失败可重试                | 通过（Mock/页面） | `admin-resource-scopes-api.test.ts`、`AdminResourceScopesPage.test.tsx` |
| AC-2-02  | 创建必须从 Apps 选择并提交字符串业务 `target_app_id`，字段校验/规范化正确  | 通过（Mock）      | 页面创建测试与 API 映射测试                                             |
| AC-2-03  | 启用/禁用使用数字 Scope `id`、无请求体，并正确反馈 `changed`               | 通过（Mock）      | API 状态测试、页面状态操作实现与失败断言                                |
| AC-2-04  | Apps 候选可按关键词检索；超过 100 条提示不完整；失败时可重试且不能手填绕过 | 通过（Mock）      | 页面候选上限/失败重试测试                                               |
| AC-2-05  | `/resource-scopes` 导航可用，且不包含编辑、删除、Grant 或级联推断          | 通过              | `App.test.tsx` 6 tests 与范围源码搜索                                   |
| AC-2-06  | 定向、lint、格式、全量测试、构建和 diff 检查通过                           | 通过              | 第 5.1 节命令结果                                                       |
| AC-2-ENV | 真实 API 读取和受控写操作完成                                              | 待环境验证        | `/api` 载荷无效；写操作未授权                                           |

本地必需验收项已通过；按照项目现有阶段口径，真实环境联调未完成前阶段保持“部分完成”。

## 7. 安全、兼容性与可观测性核对

### 安全

- Bearer Token、API base URL 和 401 logout 继续复用现有 API Client；
- 目标应用只能从后端候选选择，页面不提供自由文本旁路；
- 自动测试全部使用 Mock，浏览器检查没有提交创建或状态写操作；
- 本阶段未处理、输出或保存真实 Token、Secret 或生产数据；
- 页面不推断禁用 App/Scope 对 Grant 的级联效果。

### 兼容性

- `/users`、`/roles`、`/permissions`、`/apps` 路由测试继续通过；
- standalone 和 qiankun 公共契约未修改；
- 无依赖、锁文件、数据库或配置迁移；
- 新路由、菜单和分页样式为增量变化，旧管理页行为未修改。

### 可观测性

- 本阶段未新增日志、指标或追踪；
- 列表和候选失败通过错误态、重试入口及 Ant Design message 反馈；
- 浏览器 Network/Console 用于确认请求路径和无效响应边界，没有记录敏感响应内容。

## 8. 遗留问题与后续阶段入口

### 8.1 当前阶段遗留问题

| 问题                                    | 影响                                    | 负责人/条件                                     | 处理阶段        |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------- | --------------- |
| standalone `/api` 未返回真实领域 Schema | 本地浏览器无法验证真实 Apps/Scopes 列表 | 配置真实 API 基地址、同源代理或实际宿主环境     | 受控联调        |
| 缺少受控管理员 Token 和写操作授权       | 无法验证真实创建和启停                  | 提供受控账号、测试命名与恢复方案                | 发布前/受控联调 |
| Apps 候选单次上限 100 条                | 极大应用集下仍需关键词缩小范围          | 当前远程关键词搜索；必要时后端增强搜索/分页契约 | 后端能力评估    |
| 既有测试有 Ant Design warning           | 测试输出有噪声但不失败                  | 独立维护任务调整既有组件挂载方式                | 非本阶段阻塞    |
| 构建单 chunk 超过 500 kB                | 首屏包较大警告                          | 独立性能/拆包评估                               | 非本阶段阻塞    |

### 8.2 下一阶段可复用能力

- `listAdminApps` 可提供 Grant caller/target App 候选，继续提交字符串业务 `app_id`；
- `listAdminResourceScopes` 可按 `target_app_id` 和 `is_enabled: true` 加载 Grant 可选 Scope，提交数字 Scope `id`；
- Apps/Scopes 候选上限和失败提示模式可在 Grant 联动中复用；
- 第 3 阶段开始前仍需重新读取 Service Grants OpenAPI，且不得把本阶段待环境验证误记为已通过。

## 9. 文档同步记录

- [总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)：更新第 2 阶段状态、计划/执行记录链接、代码现状、验收结论和第 3 阶段入口；
- [第 2 阶段实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_2_PLAN.md)：更新阶段状态、验收结果和实际设计调整；
- 本执行记录：记录实际代码、验证结果、计划偏差、环境限制和遗留问题。

## 10. 阶段结论

第 2 阶段部分完成：

- Resource Scopes 前端列表、Apps 约束选择、创建和状态管理已经落地；
- 定向测试、lint、格式、全量测试、构建和 diff 检查全部通过；
- 浏览器页面与表单检查通过，真实 API 领域数据和所有写操作均未完成受控验证；
- 可以开始准备第 3 阶段 Service Grants 的实现计划，但在宣称第 2 阶段完整验收或发布前，仍需完成受控真实环境联调。
