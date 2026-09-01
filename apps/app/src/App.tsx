import { AppstoreOutlined, SafetyOutlined, TeamOutlined } from "@ant-design/icons";
import { Layout, Menu, type MenuProps } from "antd";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminUsersPage from "./pages/AdminUsersPage";

const { Content, Sider } = Layout;

const menuItems: MenuProps["items"] = [
  {
    key: "/users",
    icon: <TeamOutlined />,
    label: "用户管理"
  },
  {
    key: "/roles",
    icon: <SafetyOutlined />,
    label: "角色管理"
  },
  {
    key: "/permissions",
    icon: <AppstoreOutlined />,
    label: "权限管理"
  }
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = menuItems?.find((item) => item && "key" in item && location.pathname.startsWith(String(item.key)))?.key;

  return (
    <Layout className="app-shell">
      <Sider className="app-sider" width={240} theme="light">
        <Menu
          className="app-menu"
          mode="inline"
          items={menuItems}
          selectedKeys={selectedKey ? [String(selectedKey)] : []}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content className="app-content">
        <Routes>
          <Route path="/users" element={<AdminUsersPage />} />
          <Route path="/roles" element={<AdminRolesPage />} />
          <Route path="/permissions" element={<AdminPermissionsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}
