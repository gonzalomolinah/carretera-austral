import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  badge?: number | string;
  badgeLabel?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface BottomNavProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  items: readonly BottomNavItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
}

type NavStyle = CSSProperties & { "--ca-nav-count"?: number };

export function BottomNav({
  activeId,
  ariaLabel = "Navegación principal",
  className,
  items,
  onChange,
  style,
  ...props
}: BottomNavProps) {
  const select = (item: BottomNavItem) => {
    if (item.disabled) return;
    item.onSelect?.();
    onChange?.(item.id);
  };

  const navStyle: NavStyle = {
    ...style,
    "--ca-nav-count": Math.max(items.length, 1),
  };

  return (
    <nav
      {...props}
      aria-label={ariaLabel}
      className={cx("ca-bottom-nav", className)}
      style={navStyle}
    >
      <ul className="ca-bottom-nav__list">
        {items.map((item) => {
          const active = item.id === activeId;
          const accessibleLabel = item.badgeLabel
            ? `${item.label}, ${item.badgeLabel}`
            : undefined;
          const content = (
            <>
              <span aria-hidden="true" className="ca-bottom-nav__icon">
                {item.icon}
                {item.badge !== undefined ? (
                  <span className="ca-bottom-nav__badge">{item.badge}</span>
                ) : null}
              </span>
              <span className="ca-bottom-nav__label">{item.label}</span>
            </>
          );

          return (
            <li className="ca-bottom-nav__item" key={item.id}>
              {item.href ? (
                <a
                  aria-current={active ? "page" : undefined}
                  aria-disabled={item.disabled || undefined}
                  aria-label={accessibleLabel}
                  className="ca-bottom-nav__link"
                  href={item.disabled ? undefined : item.href}
                  onClick={(event) => {
                    if (item.disabled) {
                      event.preventDefault();
                      return;
                    }
                    select(item);
                  }}
                  tabIndex={item.disabled ? -1 : undefined}
                >
                  {content}
                </a>
              ) : (
                <button
                  aria-current={active ? "page" : undefined}
                  aria-label={accessibleLabel}
                  className="ca-bottom-nav__link"
                  disabled={item.disabled}
                  onClick={() => select(item)}
                  type="button"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
