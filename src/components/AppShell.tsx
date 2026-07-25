import type { HTMLAttributes, ReactNode } from "react";

import "../styles/global.css";
import { cx } from "./cx";

export type AppContentWidth = "narrow" | "default" | "wide" | "full";

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  aside?: ReactNode;
  asideLabel?: string;
  toastRegion?: ReactNode;
  mainId?: string;
  mainAs?: "main" | "div";
  mainLabelledBy?: string;
  contentWidth?: AppContentWidth;
  contentClassName?: string;
  skipLinkLabel?: string;
}

export function AppShell({
  aside,
  asideLabel = "Navegación secundaria",
  bottomNav,
  children,
  className,
  contentClassName,
  contentWidth = "wide",
  mainId = "contenido-principal",
  mainAs: Main = "main",
  mainLabelledBy,
  skipLinkLabel = "Saltar al contenido principal",
  toastRegion,
  topBar,
  ...props
}: AppShellProps) {
  return (
    <div
      {...props}
      className={cx("ca-app-shell", className)}
      data-has-aside={Boolean(aside)}
      data-has-bottom-nav={Boolean(bottomNav)}
    >
      <a className="ca-skip-link" href={`#${mainId}`}>
        {skipLinkLabel}
      </a>

      {topBar}

      <div className="ca-app-shell__layout">
        {aside ? (
          <aside aria-label={asideLabel} className="ca-app-shell__aside">
            {aside}
          </aside>
        ) : null}

        <Main
          aria-labelledby={mainLabelledBy}
          className="ca-app-shell__main"
          id={mainId}
          tabIndex={-1}
        >
          <div
            className={cx("ca-app-shell__content", contentClassName)}
            data-width={contentWidth}
          >
            {children}
          </div>
        </Main>
      </div>

      {bottomNav}
      {toastRegion}
    </div>
  );
}
