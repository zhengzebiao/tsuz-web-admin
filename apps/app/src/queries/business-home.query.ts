import { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";

export interface BusinessMetric {
  label: string;
  value: number;
  suffix?: string;
  trend: string;
  color: "blue" | "green" | "gold";
}

export interface BusinessHomeSummary {
  apiBaseUrl: string;
  currentUserName: string;
  metrics: BusinessMetric[];
  nextActions: string[];
}

export interface LoadBusinessHomeSummaryOptions {
  apiBaseUrl?: string;
  currentUser?: CurrentUser;
}

export function businessHomeQueryKey(apiBaseUrl = DEFAULT_API_BASE_URL, userId = "guest") {
  return ["business-home", apiBaseUrl, userId] as const;
}

export async function loadBusinessHomeSummary(options: LoadBusinessHomeSummaryOptions = {}): Promise<BusinessHomeSummary> {
  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const currentUserName = options.currentUser?.name ?? "Standalone visitor";

  return {
    apiBaseUrl,
    currentUserName,
    metrics: [
      { label: "Open orders", value: 128, trend: "+12% demo", color: "blue" },
      { label: "SLA", value: 99.9, suffix: "%", trend: "healthy", color: "green" },
      { label: "Pending reviews", value: 7, trend: "needs attention", color: "gold" }
    ],
    nextActions: [
      "Replace deterministic demo data with a domain API query.",
      "Keep auth token access behind the shared MicroAppProps bridge.",
      "Use Docker/nginx smoke checks before promoting container images."
    ]
  };
}
