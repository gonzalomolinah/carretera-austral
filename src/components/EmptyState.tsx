import { useId, type HTMLAttributes, type ReactNode } from "react";

import { Icon } from "./Icon";
import { cx } from "./cx";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  as?: "section" | "div";
  headingLevel?: 2 | 3 | 4;
}

export function EmptyState({
  action,
  as: Component = "section",
  className,
  compact = false,
  description,
  eyebrow,
  headingLevel = 2,
  icon = <Icon name="compass" />,
  secondaryAction,
  title,
  ...props
}: EmptyStateProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = description ? `${baseId}-description` : undefined;
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <Component
      {...props}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={cx("ca-empty-state", className)}
      data-compact={compact}
    >
      <div aria-hidden="true" className="ca-empty-state__icon">
        {icon}
      </div>
      {eyebrow ? <p className="ca-eyebrow">{eyebrow}</p> : null}
      <Heading className="ca-empty-state__title" id={titleId}>
        {title}
      </Heading>
      {description ? (
        <div className="ca-empty-state__description" id={descriptionId}>
          {description}
        </div>
      ) : null}
      {action || secondaryAction ? (
        <div className="ca-empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </Component>
  );
}
