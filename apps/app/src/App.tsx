import { Layout, Space, Typography } from "antd";
import { Link, Route, Routes } from "react-router-dom";
import { ErrorState, Logo, PageContainer } from "@tsuz/ui";
import BusinessHomePage from "./pages/BusinessHomePage";
import { useAppStore } from "./stores/app.store";

const { Header, Content } = Layout;

export default function App() {
  const appName = useAppStore((state) => state.appName);
  const mode = useAppStore((state) => state.mode);

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Logo label={appName} subtitle="qiankun sub app" />
        <nav className="app-nav">
          <Link to="/">Business home</Link>
          <Link to="/about">About</Link>
        </nav>
        <Typography.Text className="runtime-mode">{mode === "qiankun" ? "Mounted by host" : "Standalone mode"}</Typography.Text>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<BusinessHomePage />} />
          <Route path="/about" element={<IntegrationNotesPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

function IntegrationNotesPage() {
  const apiBaseUrl = useAppStore((state) => state.apiBaseUrl);
  const basename = useAppStore((state) => state.basename);

  return (
    <PageContainer title="Integration notes" description="Use the shared contracts when connecting this sub application to the host shell.">
      <Space direction="vertical" size="large" className="full-width">
        <Typography.Paragraph>
          The generated mfe-app reads qiankun props through a Zustand store, wraps routes with React Query and React Router,
          and creates API clients through the shared workspace packages.
        </Typography.Paragraph>
        <ErrorState
          title="Backend integration extension point"
          description={"Wire real requests through createMfeApiClient when replacing the demo business query. Current base URL: " + apiBaseUrl}
        />
        <Typography.Text type="secondary">Router basename: {basename}</Typography.Text>
      </Space>
    </PageContainer>
  );
}
