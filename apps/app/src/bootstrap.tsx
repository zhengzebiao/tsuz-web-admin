import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { AppProviders } from "./providers/AppProviders";
import { createMfeApiClient } from "./services/api-client";
import { useAppStore } from "./stores/app.store";
import type { MfeAppProps } from "./qiankun";

let root: Root | undefined;

export function render(props: MfeAppProps = {}) {
  const container = props.container?.querySelector("#root") ?? document.getElementById("root");

  if (!container) {
    throw new Error("Missing #root container for mfe-app.");
  }

  destroy();
  useAppStore.getState().setHostProps(props);

  const { basename } = useAppStore.getState();
  root = createRoot(container);
  root.render(
    <StrictMode>
      <AppProviders basename={basename}>
        <App />
      </AppProviders>
    </StrictMode>
  );

  void createMfeApiClient(props);
}

export function destroy() {
  root?.unmount();
  root = undefined;
  useAppStore.getState().resetHostProps();
}
