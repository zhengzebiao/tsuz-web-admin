# admin-users 第一阶段实现计划

> 状态：已实施，待执行记录归档
>
> 总方案：[ADMIN_USERS_IMPLEMENTATION_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PLAN.md)
>
> 阶段目标：完成核心用户列表和用户操作，不接入创建角色或用户角色分配。

## 范围

### 实现

- `GET /admin/users` 服务端分页、关键词、启用状态和黑名单状态筛选；
- Ant Design Table 展示用户及两个 Switch；
- 禁用/拉黑使用原因表单，开启/解禁使用确认弹窗；
- 新增、编辑、详情、重置密码和强制下线；
- 认证桥接、加载/错误/空状态、操作成功/失败提示；
- API 映射测试和既有导航回归适配。

### 不实现

- `POST /admin/roles` 创建角色及创建角色入口；
- 用户角色读取/替换；
- 批量、导入、导出、删除和后端改造。

## 设计

- `admin-users-api.ts` 集中定义 OpenAPI 类型和请求函数；
- 页面复用 `createMfeApiClient`、`useAppStore` 和 TanStack Query；
- 写操作成功后失效用户列表，失败不乐观更新 Switch；
- 编辑提交列表项 `version`；详情独立 GET 请求；敏感密码只通过密码输入框提交。

## 验收

- [x] 列表、分页和筛选可渲染并映射正确 query；
- [x] 两个 Switch 按接口是否需要 reason 分流到表单/确认；
- [x] 新增、编辑、详情、重置密码和强制下线入口存在；
- [x] 未调用创建角色接口；
- [ ] 真实测试 API 写操作联调（需受控账号和明确授权，阶段外执行）；
- [x] 本地 lint、test、build 通过。
