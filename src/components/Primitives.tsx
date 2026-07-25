import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "surface" | "quiet" | "danger";
export type ControlSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  children,
  className,
  disabled,
  fullWidth = false,
  leadingIcon,
  loading = false,
  loadingLabel = "Procesando…",
  size = "md",
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={cx("ca-button", className)}
      data-full-width={fullWidth}
      data-size={size}
      data-variant={variant}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <span aria-hidden="true" className="ca-spinner" /> : leadingIcon}
      <span>{loading ? loadingLabel : children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
}

export function IconButton({
  className,
  icon,
  label,
  size = "md",
  title,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={cx("ca-icon-button", className)}
      data-size={size}
      title={title ?? label}
      type={type}
    >
      {icon}
    </button>
  );
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "section" | "div";
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "default" | "subtle" | "strong";
}

export function Card({
  as: Component = "div",
  className,
  padding = "md",
  tone = "default",
  ...props
}: CardProps) {
  return (
    <Component
      {...props}
      className={cx("ca-card", className)}
      data-padding={padding}
      data-tone={tone}
    />
  );
}

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function VisuallyHidden({ className, ...props }: VisuallyHiddenProps) {
  return <span {...props} className={cx("ca-visually-hidden", className)} />;
}
