import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

export interface TopBarProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  titleAs?: "h1" | "h2" | "p" | "div";
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  sticky?: boolean;
}

export function TopBar({
  actions,
  className,
  eyebrow,
  leading,
  status,
  sticky = true,
  subtitle,
  title,
  titleAs: Title = "h1",
  ...props
}: TopBarProps) {
  return (
    <header {...props} className={cx("ca-top-bar", className)} data-sticky={sticky}>
      <div className="ca-top-bar__inner">
        {leading ? <div className="ca-top-bar__leading">{leading}</div> : null}

        <div className="ca-top-bar__title-group">
          {eyebrow ? <p className="ca-top-bar__eyebrow">{eyebrow}</p> : null}
          <Title className="ca-top-bar__title">{title}</Title>
          {subtitle ? <p className="ca-top-bar__subtitle">{subtitle}</p> : null}
        </div>

        {actions ? <div className="ca-top-bar__actions">{actions}</div> : null}
        {status ? <div className="ca-top-bar__status">{status}</div> : null}
      </div>
    </header>
  );
}
