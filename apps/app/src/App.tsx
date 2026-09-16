import {
  ApiOutlined,
  AppstoreOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { Layout, Menu, type MenuProps } from "antd";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminAppsPage from "./pages/AdminAppsPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminResourceScopesPage from "./pages/AdminResourceScopesPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminServiceGrantsPage from "./pages/AdminServiceGrantsPage";
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
  },
  {
    key: "/apps",
    icon: <ApiOutlined />,
    label: "应用管理"
  },
  {
    key: "/resource-scopes",
    icon: <KeyOutlined />,
    label: "资源范围管理"
  },
  {
    key: "/service-grants",
    icon: <SafetyCertificateOutlined />,
    label: "服务授权管理"
  }
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = menuItems?.find(
    (item) => item && "key" in item && location.pathname.startsWith(String(item.key))
  )?.key;

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
          <Route path="/apps" element={<AdminAppsPage />} />
          <Route path="/resource-scopes" element={<AdminResourceScopesPage />} />
          <Route path="/service-grants" element={<AdminServiceGrantsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}
