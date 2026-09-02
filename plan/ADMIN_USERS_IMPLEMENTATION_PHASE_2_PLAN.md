# admin-users 第二阶段实现计划

> 状态：已实施，待执行记录归档
>
> 总方案：[ADMIN_USERS_IMPLEMENTATION_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PLAN.md)
>
> 阶段目标：为用户管理增加用户角色读取与替换能力，不实现创建角色、角色编辑、角色删除或完整角色管理页。

## 范围

### 实现

- 从 `GET /admin/roles` 获取最多 100 个启用角色；
- 从 `GET /admin/users/{user_id}/roles` 获取当前角色和角色专用 version；
- 通过 `PUT /admin/users/{user_id}/roles` 提交 `role_ids` 与角色响应的 `version`；
- 在用户列表“更多”菜单增加“分配角色”；
- 使用 Ant Design Modal、Form、Select 多选、Alert 和 Spin 完成交互；
- 保留已绑定但已禁用的角色，允许移除但不允许新选；
- 处理角色加载失败、重试、角色数量超过 100、changed 和 revoked_sessions 反馈。

### 不实现

- `POST /admin/roles` 创建角色及创建角色入口；
- 角色编辑、禁用、删除和角色/权限管理页面；
- 未获得授权时的真实 API 写操作。

## 设计约束

- 复用 `createMfeApiClient`、TanStack Query 和 Ant Design App message。
- 角色 PUT 使用用户角色 GET 响应的 `version`，不使用用户列表资料版本。
- 角色选项禁止自由输入，防止提交未知 role id。
- 角色变更成功后失效用户列表、用户详情和用户角色缓存；失败保留弹窗和选择值。
- 真实测试 API 联调需要受控管理员账号、有效认证和明确写操作授权。

## 验收标准

- [x] 用户列表操作栏可打开“分配角色”，页面不出现创建角色入口。
- [x] 当前角色和启用角色并行加载并回填多选项。
- [x] 已绑定禁用角色能显示为已禁用选项并保持已选。
- [x] 保存提交正确的 `role_ids` 和角色接口返回的 `version`，支持空数组。
- [x] 加载失败有重试入口且禁用保存；保存失败保留弹窗。
- [x] 成功提示 changed 和 revoked_sessions，并失效相关查询。
- [x] API 映射测试、页面测试、lint、format、全量 test、build 通过。
- [ ] 测试环境真实角色 PUT 联调（待受控账号和明确授权）。
