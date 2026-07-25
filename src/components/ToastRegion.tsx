import { useId, type HTMLAttributes, type ReactNode } from "react";

import { Icon, type IconName } from "./Icon";
import { IconButton } from "./Primitives";
import { cx } from "./cx";

export type ToastTone = "neutral" | "success" | "info" | "warning" | "danger";

export interface ToastNotice {
  id: string;
  message: ReactNode;
  title?: ReactNode;
  tone?: ToastTone;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissLabel?: string;
}

export interface ToastRegionProps extends HTMLAttributes<HTMLElement> {
  notices: readonly ToastNotice[];
  onDismiss?: (id: string) => void;
  ariaLabel?: string;
}

const toneIcons: Record<ToastTone, IconName> = {
  neutral: "info",
  success: "check",
  info: "info",
  warning: "alert-triangle",
  danger: "alert-circle",
};

interface ToastCardProps {
  notice: ToastNotice;
  onDismiss?: (id: string) => void;
}

function ToastCard({ notice, onDismiss }: ToastCardProps) {
  const baseId = useId();
  const tone = notice.tone ?? "neutral";
  const titleId = notice.title ? `${baseId}-title` : undefined;
  const messageId = `${baseId}-message`;

  return (
    <article
      aria-atomic="true"
      aria-describedby={messageId}
      aria-labelledby={titleId}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className="ca-toast"
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="ca-toast__icon">
        {notice.icon ?? <Icon name={toneIcons[tone]} />}
      </span>

      <div className="ca-toast__content">
        {notice.title ? (
          <p className="ca-toast__title" id={titleId}>
            {notice.title}
          </p>
        ) : null}
        <div className="ca-toast__message" id={messageId}>
          {notice.message}
        </div>
        {notice.action ? (
          <button className="ca-toast__action" onClick={notice.action.onClick} type="button">
            {notice.action.label}
          </button>
        ) : null}
      </div>

      {onDismiss ? (
        <IconButton
          className="ca-toast__dismiss"
          icon={<Icon name="x" size={18} />}
          label={notice.dismissLabel ?? "Cerrar notificación"}
          onClick={() => onDismiss(notice.id)}
          size="sm"
        />
      ) : null}
    </article>
  );
}

export function ToastRegion({
  ariaLabel = "Notificaciones",
  className,
  notices,
  onDismiss,
  ...props
}: ToastRegionProps) {
  return (
    <section
      {...props}
      aria-label={ariaLabel}
      className={cx("ca-toast-region", className)}
    >
      <ol className="ca-toast-region__list">
        {notices.map((notice) => (
          <li key={notice.id}>
            <ToastCard notice={notice} onDismiss={onDismiss} />
          </li>
        ))}
      </ol>
    </section>
  );
}
