# 管理端服务访问管理：第 3 阶段“服务授权管理”执行记录

> 状态：部分完成；代码、本地质量门禁和浏览器无副作用检查已完成，真实 API 读写联调待执行
>
> 执行日期：2026-09-16
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[第 3 阶段“服务授权管理”实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_PLAN.md)

## 1. 执行范围与结论

本次根据总方案完成第 3 阶段“服务授权管理”的代码、自动化测试、浏览器无副作用检查和文档同步。

阶段结论：Service Grants 的列表、caller/target/Scope 联动创建、有效期、撤销、候选上限/失败反馈、路由与导航已经落地，本地质量门禁通过；浏览器中的六项导航、新页面、筛选、表格和创建表单通过检查。当前 standalone `/api` 返回 Vite HTML 而非领域 JSON，且未提供受控管理员凭证或真实写操作授权，因此真实 API 读取、创建和撤销仍待环境验收，阶段状态为“部分完成”。

本阶段实际完成：

1. 新增 Service Grants API 类型和列表、创建、撤销三个请求函数，正确区分字符串业务 App ID、数字 Scope ID 和数字 Grant ID；
2. 新增 `/service-grants` 页面、导航和路由，实现分页、caller/target/状态筛选、列表失败重试和审计字段展示；
3. 复用 Apps 与 Resource Scopes Service，实现 caller/target Apps 远程候选、按 target 加载启用 Scope、target 切换清空旧 Scope 和依赖失败 fail closed；
4. 对 Apps/Scopes 100 条上限提供明确提示；Apps 可通过关键词缩小范围，Scope 不伪造搜索且不提供自由文本旁路；
5. 新增可选生效/到期时间，校验时间顺序，把本地选择时间转换为后端要求的 UTC 无时区 datetime；
6. 新增撤销原因表单，写操作不做乐观更新，并根据 `changed` 区分实际变化和幂等无变化；已撤销项保持只读；
7. 对 standalone 非法列表载荷增加安全降级，避免 Vite HTML 响应导致整页崩溃；
8. 补充 API、页面和导航测试，并完成 lint、格式、全量测试、构建、diff 检查与浏览器无副作用检查；
9. 同步 README、总方案、本阶段计划和本执行记录。

本阶段明确未实现或未执行：

- 未实现 Grant 编辑、删除、恢复、批量授权、Scope 搜索/分页增强、Secret 管理或前端状态级联推断；
- 未执行真实 Grant 创建或撤销请求；
- 未完成真实 Apps/Scopes/Grants 列表读取：当前 standalone `/api` 返回应用入口 HTML，不是领域分页 Schema；
- 未执行部署、生产检查、后端、数据库或权限策略改造。

## 2. 实际代码与配置变更

### 2.1 Service Grants API 契约

- [`apps/app/src/services/admin-service-grants-api.ts`](../apps/app/src/services/admin-service-grants-api.ts)：新增 `AdminServiceGrant`、状态、分页、创建和动作响应类型，以及列表、创建、撤销请求；
- [`apps/app/src/services/admin-service-grants-api.test.ts`](../apps/app/src/services/admin-service-grants-api.test.ts)：覆盖完整/空筛选、创建字段白名单、可选时间省略、数字 Grant ID 和撤销原因规范化。

关键实现：

```text
GET /admin/service-grants?page&page_size&caller_app_id&target_app_id&status
POST /admin/service-grants → caller_app_id + scope_id + 已填写的 valid_from/expires_at
POST /admin/service-grants/{数字 Grant id}/revoke → { reason: trim 后字符串或 null }
```

创建函数重建请求体字段白名单，即使调用方运行时对象含 UI 临时 `target_app_id` 也不会透传。Service 中没有编辑、删除、恢复、批量授权或 Secret 能力。

### 2.2 服务授权管理页面

- [`apps/app/src/pages/AdminServiceGrantsPage.tsx`](../apps/app/src/pages/AdminServiceGrantsPage.tsx)：新增 Grant 分页表格、筛选、失败重试、Apps/Scopes 联动创建、有效期和撤销；
- [`apps/app/src/pages/AdminServiceGrantsPage.test.tsx`](../apps/app/src/pages/AdminServiceGrantsPage.test.tsx)：覆盖分页筛选、非法载荷、联动、上限/失败、创建字段、时间转换/校验、创建/撤销失败、幂等反馈和已撤销只读。

关键行为：

```text
选择 caller App（字符串 app_id）
  + 选择 target App（仅 UI 联动字段）
  ↓
GET /admin/resource-scopes?page=1&page_size=100&target_app_id=...&is_enabled=true
  ↓
选择启用 Scope（数字 id）
  + 可选本地生效/到期时间
  ↓ UTC 转换并移除 Z
POST /admin/service-grants
  → 只提交 caller_app_id + scope_id + 已填写有效期
```

- caller、target Apps 使用第一页 100 条与 250ms 关键词远程查询，显示名称、业务 `app_id` 和禁用标记；
- Apps query key 归入 `admin-apps` 根前缀；Scope 候选归入 `admin-resource-scopes` 根前缀；Grant 列表归入 `admin-service-grants` 根前缀；
- target 变化立即清空 `scope_id`，只加载目标 App 下 `is_enabled: true` 的 Scope；
- Apps/Scopes 候选失败时提供重试，不回退为自由文本；超过 100 条时明确提示结果不完整；
- Scope API 不支持关键词搜索，页面明确提示需要后端扩展，不伪装为全量；
- `valid_from` 与 `expires_at` 可空；到期时间必须晚于所选生效时间，否则必须晚于当前时间；
- DatePicker 本地时间值通过 `toISOString()` 转换为 UTC，再移除尾部 `Z` 以满足后端 UTC 无时区校验；
- 服务端无时区时间补 `Z` 后按 UTC 解释，再按浏览器本地时区展示；
- Grant 状态只翻译服务端 `enabled`/`revoked`，不根据有效期推导额外状态；
- 仅 `enabled` 行提供撤销；`revoked` 行显示“只读”，没有恢复、编辑或删除入口；
- 创建/撤销失败时保留 Modal 和表单值；成功后异步失效 Grant 查询，不把刷新失败误报为写失败；
- `changed: false` 显示“操作未发生变化”；所有写操作均不做乐观更新；
- 列表及依赖候选对非数组 `items` 和非数字 `total` 安全降级，避免 standalone 非领域响应导致整页崩溃。

### 2.3 路由、导航、样式和说明

- [`apps/app/src/App.tsx`](../apps/app/src/App.tsx)：新增“服务授权管理”菜单和 `/service-grants` 路由；
- [`apps/app/src/App.test.tsx`](../apps/app/src/App.test.tsx)：导航覆盖扩展为 users、roles、permissions、apps、resource-scopes、service-grants 六项；
- [`apps/app/src/styles/main.css`](../apps/app/src/styles/main.css)：将 Service Grants 分页类加入既有居中规则；
- [`README.md`](../README.md)：更新测试覆盖、项目结构和当前六项导航说明。

### 2.4 数据、迁移和状态

不涉及数据库、缓存、队列、迁移或前端持久状态变更。筛选、页码、候选搜索、选中项和创建/撤销表单均为页面局部状态；本次没有产生真实 Grant 或其他服务端业务数据。

### 2.5 API、Schema 或公共契约

本阶段未改变后端或 workspace 公共契约，只新增前端领域类型与调用封装。现有 `MicroAppProps`、API 基地址、Bearer Token 注入和 401 logout 行为保持不变。

当前后端真实契约比总方案原“ISO 8601”描述更具体：创建请求中的 `valid_from` 和 `expires_at` 必须是 UTC 无时区 datetime。本阶段已将这一事实同步回总方案和阶段计划。

### 2.6 配置、依赖和外部服务

- 未新增配置、环境变量、顶层依赖或锁文件变化；
- DatePicker 使用 Ant Design 已内置的日期能力；
- 规划时 `127.0.0.1:8000` 未运行，改从相邻 `tsuz-api-main` 当前 `main` 提交 `cc05c66` 的应用对象生成 OpenAPI，并核对路由、Schema、Service 和后端 API 测试；Service Grants 契约自引入提交 `4805eab` 至当前没有漂移；
- 浏览器检查使用既有 standalone 默认 `/api`，没有修改或写入环境配置；
- Network 证据显示 `/api/admin/apps` 与 `/api/admin/service-grants` 返回 Vite 应用入口 HTML（200/304），不是领域分页 JSON；
- 没有调用任何真实 POST 创建或撤销接口；
- 没有记录真实 Token、Secret 或生产数据。

## 3. 关键设计结果

1. Grant 列表与创建使用 caller 字符串业务 `app_id`；target 仅用于 UI 联动和列表筛选；创建提交数字 Scope `id`；撤销路径使用数字 Grant `id`；
2. Apps 候选支持第一页 100 条和关键词远程查询；Scope 候选固定为目标 App 下启用项第一页 100 条，结果不完整时明确提示；
3. 候选依赖失败时 fail closed：页面提供重试，不提供手填或跨目标 Scope 旁路；
4. target 改变立即清空已选 Scope，避免把旧目标的 Scope 提交给新目标；
5. 创建请求字段由 Service 白名单重建，UI 临时 `target_app_id` 不会透传；
6. Grant 创建时间按本地时间输入，提交为 UTC 无时区字符串；响应中的无时区时间按 UTC 展示；
7. 写操作不做乐观更新，成功后失效 `admin-service-grants` 查询，`changed: false` 显示幂等无变化；
8. 服务端 `revoked` 是终态 UI：只读且无恢复入口；前端不推断“未生效”“已过期”或 App/Scope 禁用级联效果。

## 4. 与阶段计划的差异

| 差异               | 计划内容                     | 实际实施                                                                                                                                                                                   | 原因                                                               | 影响与处理                                                             |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 异常列表载荷鲁棒性 | 按 OpenAPI 直接读取分页响应  | Grants 列表和 Apps/Scopes 候选均校验 `items`/`total` 的运行时形状                                                                                                                          | standalone `/api` 返回 Vite HTML，通用 Client 将字符串视为成功结果 | 不改变正式契约；页面安全降级，真实 API 仍待验证                        |
| 全量测试首次结果   | 全量测试作为质量门禁         | 首次 `pnpm test` 的 81 个应用断言全部通过，但 Vitest 捕获 3 个来自既有 `AdminRolesPage.test.tsx` 的 teardown 后 `window is not defined` 并返回失败；随后应用全量和全仓全量各重跑一次均通过 | 既有异步清理偶发错误，与第三阶段测试断言无直接关联                 | 如实保留首次失败；稳定重跑作为最终质量结论，既有清理噪声列为非阻塞遗留 |
| 浏览器真实读取     | 预期可能因 API 基址/凭证阻塞 | standalone `/api` 返回应用入口 HTML，而非 Apps/Grants Schema                                                                                                                               | Vite 开发服务没有真实 API 代理                                     | 标记待环境验证，不把 HTTP 200/304 视为领域 API 通过                    |

上述调整没有扩大到后端、部署、Grant 编辑/删除/恢复、Scope 搜索或真实写操作。

## 5. 测试与验证结果

### 5.1 验证汇总

| 检查               | 命令或方法                                                                                                                                                | 结果                           | 证据/说明                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| 定向测试           | `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-service-grants-api.test.ts src/pages/AdminServiceGrantsPage.test.tsx src/App.test.tsx` | 通过                           | 3 files，25 tests                                                                        |
| Lint/类型          | `pnpm lint`                                                                                                                                               | 通过                           | 4 个 workspace package 均通过 TypeScript no-emit 检查                                    |
| 新增/修改文件格式  | `pnpm exec prettier --check ...`                                                                                                                          | 通过                           | 本阶段 TypeScript、CSS 和 Markdown 文件全部匹配                                          |
| 仓库格式门禁       | `pnpm format:check`                                                                                                                                       | 通过                           | 仓库脚本覆盖的配置文件全部匹配                                                           |
| 应用全量测试复核   | `pnpm --filter tsuz-web-admin-app test`                                                                                                                   | 通过                           | App 19 files / 81 tests                                                                  |
| 全仓测试首次       | `pnpm test`                                                                                                                                               | 失败（偶发）                   | 所有断言通过，但既有 Roles 测试 teardown 后发生 3 个 `window is not defined` 未处理错误  |
| 全仓测试重跑       | `pnpm test`                                                                                                                                               | 通过                           | 4 个 workspace task；App 19 files / 81 tests，API 3 tests，Shared 3 tests，UI 无配置测试 |
| 构建               | `pnpm build`                                                                                                                                              | 通过                           | Vite 成功构建；存在单 chunk 超过 500 kB 的非阻塞警告                                     |
| Diff 检查          | `git diff --check`                                                                                                                                        | 通过                           | 无空白错误                                                                               |
| 浏览器无副作用检查 | DevTools 打开 `http://127.0.0.1:7201/service-grants`                                                                                                      | 通过（页面）/待环境验证（API） | 六项导航、筛选、表格、空态、创建 Modal、时间字段和响应式布局通过；真实领域数据未取得     |

### 5.2 失败与未执行项

- 首次全仓测试失败：App 的 19 个文件、81 个断言全部通过，但 Vitest 在环境拆除后捕获 3 个来自既有 `AdminRolesPage.test.tsx` 的 React 调度异常 `window is not defined`；独立应用全量和随后全仓全量重跑均通过。本阶段没有修改 Roles 页面或测试；该偶发清理问题继续作为测试噪声追踪；
- 浏览器真实列表读取未通过：standalone `/api/admin/apps` 和 `/api/admin/service-grants` 返回 Vite HTML，不是 OpenAPI 对应分页 Schema；
- 未执行真实创建和撤销：缺少受控认证、写操作授权和测试数据恢复方案；
- 测试仍输出既有 users/roles/permissions 的 Ant Design Form/Spin warning；第三阶段 DatePicker 时间顺序测试输出一次 Shadow DOM warning，均不导致断言失败；
- 构建存在仓库既有的大 chunk 非阻塞 warning，本阶段未扩大范围做代码拆分；
- 浏览器 Console 报告 3 个 Form label 可访问性 issue，以及 Ant Design 5 与 React 19 的既有兼容提示；页面控件均有 aria-label，未在本阶段改造框架版本或全局 Form 结构。

### 5.3 真实环境或人工验证

| 验证项                       | 环境                       | 副作用/授权                      | 结果                                                                  |
| ---------------------------- | -------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `/service-grants` 路由和布局 | 本地 Vite `7201`，1024×768 | 无写副作用                       | 通过；六项导航、筛选、表格、空态和横向滚动布局可用                    |
| 创建授权 Modal               | 本地 Vite                  | 只打开/关闭，不提交              | 通过；caller、target、初始禁用的 Scope 选择器、两个时间字段和提示可见 |
| Apps/Grants GET              | standalone `/api`          | 只读                             | 待环境验证；当前响应为 Vite HTML，不能视为真实接口通过                |
| Grant 创建/撤销              | 未执行                     | 需要受控账号、明确授权和清理方案 | 未执行；没有触发任何真实 POST                                         |
| qiankun 宿主模式             | 未执行                     | 需要可用宿主登录态和 API 基地址  | 未执行；公共契约由类型与旧测试回归覆盖，不能替代真实挂载验证          |

## 6. 阶段验收结果

| 编号     | 验收标准                                                                     | 结果              | 验证证据                                                              |
| -------- | ---------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| AC-3-01  | Grant 列表分页、caller/target/服务端状态筛选映射正确，失败可重试             | 通过（Mock/页面） | `admin-service-grants-api.test.ts`、`AdminServiceGrantsPage.test.tsx` |
| AC-3-02  | caller/target 从 Apps 选择，按 target 只加载启用 Scope；依赖失败不能手填绕过 | 通过（Mock）      | 页面联动、切换清空和依赖失败测试                                      |
| AC-3-03  | Apps/Scopes 超过 100 条明确提示；Apps 可关键词缩小，Scope 不伪造搜索         | 通过（Mock）      | 页面候选上限与失败重试测试                                            |
| AC-3-04  | 创建只提交 caller、数字 Scope ID 和已填写有效期，不携带临时 target           | 通过（Mock）      | API 字段白名单与页面创建测试                                          |
| AC-3-05  | 时间顺序校验正确，本地时间转换为 UTC 无时区 datetime                         | 通过（Mock）      | DatePicker 转换与反向时间窗测试                                       |
| AC-3-06  | 撤销使用数字 Grant ID 和 `{ reason }`，反馈 `changed`，失败不乐观更新        | 通过（Mock）      | API 撤销、页面成功/幂等/失败测试                                      |
| AC-3-07  | 已撤销项只读，无编辑、删除、恢复、批量或状态推导                             | 通过              | 页面只读测试与范围源码核对                                            |
| AC-3-08  | `/service-grants` 导航可用，旧五项及公共宿主契约兼容                         | 通过              | `App.test.tsx` 7 tests 与全量回归                                     |
| AC-3-09  | 定向、lint、格式、全量测试、构建和 diff 检查通过                             | 通过（重跑）      | 第 5.1 节命令；首次偶发失败保留在第 5.2 节                            |
| AC-3-ENV | 真实 API 读取及受控创建/撤销完成                                             | 待环境验证        | `/api` 返回 HTML；写操作未授权                                        |

本地必需验收项已通过；按照项目现有阶段口径，真实环境联调未完成前阶段保持“部分完成”。

## 7. 安全、兼容性与可观测性核对

### 安全

- Bearer Token、API base URL 和 401 logout 继续复用现有 API Client；
- caller、target 和 Scope 只能从后端候选选择，页面不提供自由文本旁路；
- 创建字段白名单不透传 UI 临时 target；时间值经过顺序校验和 UTC 转换；
- 自动测试全部使用 Mock，浏览器检查没有提交创建或撤销；
- 本阶段未处理、输出或保存真实 Token、Secret 或生产数据；
- 页面不推断 App/Scope 禁用或有效期对 Grant 的实际授权效果。

### 兼容性

- `/users`、`/roles`、`/permissions`、`/apps`、`/resource-scopes` 路由测试继续通过；
- standalone 和 qiankun 公共契约未修改；
- 无依赖、锁文件、数据库或配置迁移；
- 新路由、菜单和分页样式为增量变化，旧管理页业务代码未修改；
- 前端代码可回滚，但真实环境中已创建或撤销的 Grant 不能由前端回滚恢复。

### 可观测性

- 本阶段未新增日志、指标或追踪；
- 列表、Apps/Scopes 依赖和写操作失败通过错误态、重试入口及 Ant Design message 反馈；
- 浏览器 Network/Console 用于确认请求路径、Vite HTML 非法载荷和页面警告，没有记录敏感响应内容。

## 8. 遗留问题与后续阶段入口

### 8.1 当前阶段遗留问题

| 问题                              | 影响                                 | 负责人/条件                                   | 处理阶段        |
| --------------------------------- | ------------------------------------ | --------------------------------------------- | --------------- |
| standalone `/api` 返回 Vite HTML  | 无法验证真实 Apps/Scopes/Grants 列表 | 配置真实 API 基地址、同源代理或实际宿主环境   | 受控联调        |
| 缺少受控管理员 Token 和写操作授权 | 无法验证真实 Grant 创建和撤销        | 提供受控账号、测试命名与清理方案              | 发布前/受控联调 |
| Scope 候选单次上限 100 且无搜索   | 极大 Scope 集下目标项可能不可选      | 后端增加搜索或分页契约                        | 后端能力评估    |
| 既有 Roles 测试偶发 teardown 错误 | 全仓测试首次运行可能非确定性失败     | 独立维护任务等待 React 调度完成或调整清理方式 | 非本阶段阻塞    |
| 既有 Ant Design/React warning     | 测试与浏览器控制台有噪声             | 框架兼容与表单可访问性维护任务                | 非本阶段阻塞    |
| 构建单 chunk 超过 500 kB          | 首屏包较大警告                       | 独立性能/拆包评估                             | 非本阶段阻塞    |

### 8.2 下一阶段可复用能力

本总方案的三个代码阶段均已实施。发布或整体完成前仍需：

- 在真实宿主或正确 API 基地址下验证 Apps、Scopes、Grants GET 与 Bearer/401/403 行为；
- 获得明确授权后使用可清理测试数据验证 Grant 创建、幂等响应和撤销；
- 继续遵守 Secret 不持久化、候选 fail closed、服务端状态为准和不自动重试写操作的约束；
- 根据真实 Scope 数量评估后端搜索/分页增强，不在前端伪造全量候选。

## 9. 文档同步记录

- [总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)：更新第 3 阶段状态、计划/执行记录链接、代码现状、UTC 时间契约、验收结论和部署检查；
- [第 3 阶段实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_3_PLAN.md)：更新阶段状态、验收结果和实际设计调整；
- 本执行记录：记录实际代码、验证结果、首次偶发测试失败、环境限制和遗留问题；
- [`README.md`](../README.md)：更新测试覆盖、项目结构和六项导航。

## 10. 阶段结论

第 3 阶段部分完成：

- Service Grants 前端列表、约束联动创建、有效期、撤销和只读边界已经落地；
- 定向测试、lint、格式、全量测试重跑、构建和 diff 检查通过；首次全仓测试的既有 teardown 偶发错误已如实保留；
- 浏览器页面与创建表单检查通过，真实 API 领域数据和所有写操作均未完成受控验证；
- 三个代码阶段均已达到本地实施目标；总方案在完成受控真实环境联调前继续保持“实施中”，本阶段保持“部分完成”。
