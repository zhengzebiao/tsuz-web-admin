import type { MicroAppProps } from "@tsuz/shared";
import { destroy, render } from "./bootstrap";

export type MfeAppProps = Partial<MicroAppProps>;

export async function bootstrap() {
  return Promise.resolve();
}

export async function mount(props: MfeAppProps = {}) {
  render(props);
}

export async function unmount() {
  destroy();
}

export async function update(props: MfeAppProps = {}) {
  render(props);
}
