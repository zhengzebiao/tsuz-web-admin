import type { CSSProperties, ReactNode } from "react";

export interface LogoProps {
  label?: string;
  subtitle?: string;
  className?: string;
}

export function Logo({ label = "Tsu MFE", subtitle = "Micro frontend workspace", className }: LogoProps) {
  return (
    <div className={joinClassNames("tsu-logo", className)} style={logoStyle}>
      <span aria-hidden="true" style={logoMarkStyle}>
        T
      </span>
      <span>
        <strong style={logoLabelStyle}>{label}</strong>
        <small style={logoSubtitleStyle}>{subtitle}</small>
      </span>
    </div>
  );
}

export interface PageContainerProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageContainer({ title, description, actions, children, className }: PageContainerProps) {
  return (
    <section className={joinClassNames("tsu-page-container", className)} style={pageContainerStyle}>
      {title || description || actions ? (
        <header style={pageHeaderStyle}>
          <div>
            {title ? <h1 style={pageTitleStyle}>{title}</h1> : null}
            {description ? <p style={pageDescriptionStyle}>{description}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title = "Nothing here yet", description, action, className }: EmptyStateProps) {
  return (
    <div className={joinClassNames("tsu-empty-state", className)} style={stateStyle}>
      <strong>{title}</strong>
      {description ? <p style={stateDescriptionStyle}>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", description, action, className }: ErrorStateProps) {
  return (
    <div className={joinClassNames("tsu-error-state", className)} style={{ ...stateStyle, borderColor: "#fecaca", background: "#fff7f7" }}>
      <strong>{title}</strong>
      {description ? <p style={stateDescriptionStyle}>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const logoStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  lineHeight: 1.1
};

const logoMarkStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "linear-gradient(135deg, #1677ff, #7c3aed)",
  color: "#fff",
  fontWeight: 800
};

const logoLabelStyle: CSSProperties = {
  display: "block",
  color: "inherit"
};

const logoSubtitleStyle: CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: 12
};

const pageContainerStyle: CSSProperties = {
  display: "grid",
  gap: 24
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-start"
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.2
};

const pageDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b"
};

const stateStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 8,
  minHeight: 180,
  padding: 24,
  border: "1px dashed #bfdbfe",
  borderRadius: 16,
  background: "#f8fbff",
  color: "#31506f",
  textAlign: "center"
};

const stateDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b"
};
