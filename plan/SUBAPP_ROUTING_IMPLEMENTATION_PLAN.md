# 管理员子应用路由与资源代理实施方案

> 状态：实施中
>
> 本方案基于 `tsuz-web-admin` 的 Vite、qiankun、Docker、Nginx 和 GitHub Actions 部署架构，以及主应用已确认的 `/app/**` 页面路由与 `/subapps/**` 资源路由契约。
>
> 第二阶段文档：[实现计划](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md) · [执行记录](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_EXECUTION.md)

## 1. 已确认决策

| 项目           | 决策                                             | 来源                        |
| -------------- | ------------------------------------------------ | --------------------------- |
| 用户访问地址   | `https://test.tusz.online/app/admin`             | 用户确认、主应用契约        |
| 管理员资源入口 | `https://test.tusz.online/subapps/admin/`        | 已确认路由方案              |
| 本地开发地址   | `http://127.0.0.1:7201/`                         | 当前 Vite 配置              |
| 生产资源前缀   | `/subapps/admin/`                                | 已确认路由方案              |
| 页面 basename  | 主应用挂载时为 `/app/admin`，独立运行时为 `/`    | 现有 host props/Router 契约 |
| 后端 API       | `https://test-api.tusz.online`                   | 测试环境配置                |
| 资源代理       | 外层 Nginx `/subapps/admin/` → `127.0.0.1:7201/` | 第三阶段实施                |

## 2. 背景与现状

管理员子应用能够独立运行并提供 qiankun 生命周期，但 Vite 生产构建原先没有显式 `base`，入口会引用根 `/assets/*`。当主应用与子应用共用 `test.tusz.online` 时，这些请求会被主应用 7200 接收，导致管理员资源加载失败。

现有能力可直接复用：

- `apps/app/src/main.tsx` 和 `apps/app/src/qiankun.ts` 已提供完整 qiankun 生命周期；
- `apps/app/src/providers/AppProviders.tsx` 已根据 host props 设置 Router basename；
- `nginx/nginx.conf` 已支持 SPA fallback 和 qiankun 资源 CORS；
- Dockerfile、Compose 和部署 workflow 已支持 Vite 构建参数及不可变 tag 发布。

## 3. 目标与非目标

### 3.1 目标

1. 使用 `VITE_PUBLIC_BASE` 控制管理员子应用的 Vite 资源前缀；
2. 本地开发默认保持 `/`，测试/生产镜像使用 `/subapps/admin/`；
3. Docker、Compose、部署 workflow 和环境示例完整传递该构建变量；
4. 验证入口 HTML、CSS、JS 引用均带 `/subapps/admin/`，且没有根 `/assets/` 引用；
5. 保持现有 qiankun 生命周期、host props、API client 和业务页面不变。

### 3.2 非目标

- 不修改主应用 `/app/admin` 路由或 auth bridge；
- 不配置或重载服务器外层 Nginx；
- 不部署、推送镜像或执行真实测试环境联调；
- 不接入管理员用户、角色、权限 API；
- 不实现其他子应用或动态 manifest。

## 4. 总体设计

```text
VITE_PUBLIC_BASE=/subapps/admin/
  ↓
Vite base 规范化为 /subapps/admin/
  ↓
生产 index.html 引用 /subapps/admin/assets/*
  ↓
外层 Nginx 去除 /subapps/admin/ 前缀并代理到 7201
  ↓
子应用容器 Nginx 从 /assets/* 提供构建产物
```

`VITE_PUBLIC_BASE` 只控制子应用自身静态资源，不等同于主应用的 `VITE_ADMIN_APP_ENTRY`：

```dotenv
# 主应用
VITE_ADMIN_APP_ENTRY=https://test.tusz.online/subapps/admin/

# 管理员子应用
VITE_PUBLIC_BASE=/subapps/admin/
```

## 5. 配置与兼容策略

| 配置                | 本地默认值 | 测试/生产值                    | 说明                            |
| ------------------- | ---------- | ------------------------------ | ------------------------------- |
| `VITE_PUBLIC_BASE`  | `/`        | `/subapps/admin/`              | Vite 资源前缀                   |
| `VITE_API_BASE_URL` | `/api`     | `https://test-api.tusz.online` | 独立运行时 API；host props 优先 |
| `VITE_APP_ENV`      | `local`    | `test`/`product`               | 构建环境标签                    |
| `APP_PORT`          | `7201`     | `7201`                         | 宿主机端口                      |

`VITE_PUBLIC_BASE` 会规范化首尾斜杠；空值回退 `/`。旧镜像保持旧资源路径，可通过不可变 tag 回滚。配置变化必须构建新镜像，不能通过重启旧容器生效。

## 6. 文件范围

- `apps/app/vite.config.ts`：读取并规范化 `VITE_PUBLIC_BASE`；
- `Dockerfile`、`docker-compose.yml`：传递构建参数；
- `.github/workflows/deploy.yml`：服务器构建和生成部署环境文件时传递变量；
- `.env.deploy.example`、`apps/app/.env.example`、`apps/app/src/vite-env.d.ts`：同步示例和类型；
- `README.md`：说明页面路由、资源入口、本地和测试环境配置；
- `plan/`：维护阶段计划和执行记录。

本方案不涉及数据库、缓存、API Schema 或 npm 依赖变化。

## 7. 安全与运维边界

- `/app/admin` 必须由主应用处理，不能直接代理到 7201，以免绕过主应用认证；
- `/subapps/admin/` 只承载 entry 和静态资源；
- CCR token、SSH 私钥等 Secret 继续由 GitHub Environment 注入，不写入仓库或持久运行时 `.env`；
- 外层 Nginx 变更和真实部署属于第三阶段，需要明确授权；
- 子应用静态资源允许被主应用加载，但 API CORS 仍由后端独立控制。

## 8. 分阶段实施

### 第一阶段：主应用管理员入口接入

> 状态：已完成（位于 `tsuz-web-main` 仓库）

主应用已将受保护页面切换到 `/app/admin`，并使用 `VITE_ADMIN_APP_ENTRY` 指向管理员资源入口。

### 第二阶段：管理员子应用子路径构建

> 状态：部分完成
>
> [实现计划](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md) · [执行记录](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_EXECUTION.md)

实现 `VITE_PUBLIC_BASE`、同步构建/部署配置并验证生产产物路径。真实 Nginx 和跨应用联调不属于本阶段。

### 第三阶段：Nginx 与真实双应用联调

> 状态：未开始

配置 `/` → 7200、`/subapps/admin/` → 7201，发布两个新镜像并验证登录、挂载、嵌套路由刷新、资源和 API 请求。

## 9. 风险与回滚

| 风险                    | 影响                                        | 检测与缓解                                         | 回滚                  |
| ----------------------- | ------------------------------------------- | -------------------------------------------------- | --------------------- |
| HTML 仍引用 `/assets/*` | 请求进入主应用，挂载失败                    | 构建后扫描 `dist/index.html`                       | 回滚旧镜像并修正 base |
| 外层 Nginx 未去除前缀   | 7201 收到不存在的 `/subapps/admin/assets/*` | 使用带尾斜杠的 `proxy_pass http://127.0.0.1:7201/` | 恢复 Nginx 配置       |
| `/app/admin` 直连 7201  | 绕过认证和 host props                       | 保持 `/app/**` 进入 7200                           | 删除错误 location     |
| 主/子配置不匹配         | qiankun entry 404                           | 同步 `VITE_ADMIN_APP_ENTRY` 与 `VITE_PUBLIC_BASE`  | 回滚对应不可变 tag    |

## 10. 完成标准

整体方案完成需要：

- 管理员构建产物使用 `/subapps/admin/assets/*`；
- 主应用通过 `/app/admin` 挂载管理员子应用；
- 测试服务器 Nginx 正确代理 7200/7201；
- 真实浏览器验证无 404、CORS、生命周期或动态资源错误；
- 各阶段计划和执行记录如实记录本地验证与环境验证结果。
