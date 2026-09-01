import { AppstoreOutlined, SafetyOutlined, TeamOutlined } from "@ant-design/icons";
import { Layout, Menu, Typography, type MenuProps } from "antd";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@tsuz/ui";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import { useAppStore } from "./stores/app.store";

const { Header, Content } = Layout;

const menuItems: MenuProps["items"] = [
  {
    key: "/admin/users",
    icon: <TeamOutlined />,
    label: "用户管理"
  },
  {
    key: "/admin/roles",
    icon: <SafetyOutlined />,
    label: "角色管理"
  },
  {
    key: "/admin/permissions",
    icon: <AppstoreOutlined />,
    label: "权限管理"
  }
];

export default function App() {
  const appName = useAppStore((state) => state.appName);
  const mode = useAppStore((state) => state.mode);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = menuItems?.find((item) => item && "key" in item && location.pathname.startsWith(String(item.key)))?.key;

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Logo label={appName} subtitle="admin console" />
        <Menu
          className="app-menu"
          mode="horizontal"
          items={menuItems}
          selectedKeys={selectedKey ? [String(selectedKey)] : []}
          onClick={({ key }) => navigate(key)}
        />
        <Typography.Text className="runtime-mode">{mode === "qiankun" ? "Mounted by host" : "Standalone mode"}</Typography.Text>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/roles" element={<AdminRolesPage />} />
          <Route path="/admin/permissions" element={<AdminPermissionsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}
