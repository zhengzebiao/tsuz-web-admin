import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./query-client";

interface AppProvidersProps extends PropsWithChildren {
  basename?: string;
}

export function AppProviders({ basename = "/", children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}
