import { qiankunWindow, renderWithQiankun } from "vite-plugin-qiankun/dist/helper";
import { render } from "./bootstrap";
import { bootstrap, mount, unmount, update } from "./qiankun";
import "./styles/main.css";

renderWithQiankun({ bootstrap, mount, unmount, update });

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render();
}

export { bootstrap, mount, unmount, update };
