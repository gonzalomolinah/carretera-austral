import type { HTMLAttributes } from "react";

import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export type SyncStatus =
  | "idle"
  | "saving"
  | "synced"
  | "pending"
  | "offline"
  | "local"
  | "conflict"
  | "error";

export interface SyncPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> {
  status: SyncStatus;
  label?: string;
  details?: string;
  onClick?: () => void;
}

const statusContent: Record<SyncStatus, { label: string; icon: IconName }> = {
  idle: { label: "Listo", icon: "cloud" },
  saving: { label: "Guardando…", icon: "refresh" },
  synced: { label: "Sincronizado", icon: "check" },
  pending: { label: "Cambios pendientes", icon: "clock" },
  offline: { label: "Sin conexión", icon: "wifi-off" },
  local: { label: "Guardado localmente", icon: "device" },
  conflict: { label: "Revisión necesaria", icon: "alert-triangle" },
  error: { label: "Error al sincronizar", icon: "alert-circle" },
};

export function SyncPill({
  className,
  details,
  label,
  onClick,
  status,
  title,
  ...props
}: SyncPillProps) {
  const content = statusContent[status];
  const visibleLabel = label ?? content.label;
  const accessibleLabel = details ? `${visibleLabel}. ${details}` : visibleLabel;
  const inner = (
    <>
      <Icon className="ca-sync-pill__icon" name={content.icon} size={14} />
      <span className="ca-sync-pill__label">{visibleLabel}</span>
    </>
  );

  return (
    <span
      {...props}
      className={cx("ca-sync-pill", className)}
      data-status={status}
    >
      <span aria-atomic="true" aria-live="polite" className="ca-visually-hidden" role="status">
        {accessibleLabel}
      </span>
      {onClick ? (
        <button
          aria-label={accessibleLabel}
          className="ca-sync-pill__control"
          onClick={onClick}
          title={title ?? details}
          type="button"
        >
          {inner}
        </button>
      ) : (
        <span
          aria-label={accessibleLabel === visibleLabel ? undefined : accessibleLabel}
          className="ca-sync-pill__content"
          title={title ?? details}
        >
          {inner}
        </span>
      )}
    </span>
  );
}
