import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { Icon } from "./Icon";
import { IconButton } from "./Primitives";
import { cx } from "./cx";

export type DialogSize = "sm" | "md" | "lg";
export type SheetSide = "bottom" | "left" | "right";

interface DialogFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
  bodyClassName?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  variant: "modal" | "sheet";
  side?: SheetSide;
}

function DialogFrame({
  bodyClassName,
  children,
  className,
  closeLabel = "Cerrar",
  closeOnBackdrop = true,
  closeOnEscape = true,
  description,
  footer,
  initialFocusRef,
  onOpenChange,
  open,
  side = "bottom",
  size = "md",
  title,
  variant,
}: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const pointerStartedOnBackdrop = useRef(false);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = description ? `${baseId}-description` : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let focusFrame = 0;

    if (open) {
      if (!wasOpen.current) {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
      }

      if (!dialog.open) {
        try {
          if (typeof dialog.showModal === "function") dialog.showModal();
          else dialog.setAttribute("open", "");
        } catch {
          dialog.setAttribute("open", "");
        }
      }

      focusFrame = window.requestAnimationFrame(() => {
        const target =
          initialFocusRef?.current ??
          dialog.querySelector<HTMLElement>("[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
        target?.focus();
      });
    } else if (dialog.open) {
      dialog.close();
    }

    if (!open && wasOpen.current) {
      window.requestAnimationFrame(() => previouslyFocused.current?.focus());
    }

    wasOpen.current = open;
    return () => window.cancelAnimationFrame(focusFrame);
  }, [initialFocusRef, open]);

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className={cx(
        "ca-dialog",
        variant === "sheet" ? "ca-dialog--sheet" : "ca-dialog--modal",
        className,
      )}
      data-side={variant === "sheet" ? side : undefined}
      data-size={size}
      onCancel={(event) => {
        event.preventDefault();
        if (closeOnEscape) onOpenChange(false);
      }}
      onClick={(event) => {
        if (
          closeOnBackdrop &&
          pointerStartedOnBackdrop.current &&
          event.currentTarget === event.target
        ) {
          onOpenChange(false);
        }
        pointerStartedOnBackdrop.current = false;
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
      onPointerDown={(event) => {
        pointerStartedOnBackdrop.current = event.currentTarget === event.target;
      }}
      ref={dialogRef}
    >
      {variant === "sheet" && side === "bottom" ? (
        <div aria-hidden="true" className="ca-dialog__grabber" />
      ) : null}

      <header className="ca-dialog__header">
        <div>
          <h2 className="ca-dialog__title" id={titleId}>
            {title}
          </h2>
          {description ? (
            <div className="ca-dialog__description" id={descriptionId}>
              {description}
            </div>
          ) : null}
        </div>
        <IconButton
          icon={<Icon name="x" size={20} />}
          label={closeLabel}
          onClick={() => onOpenChange(false)}
        />
      </header>

      <div className={cx("ca-dialog__body", bodyClassName)}>{children}</div>
      {footer ? <footer className="ca-dialog__footer">{footer}</footer> : null}
    </dialog>
  );
}

export interface ModalProps extends Omit<DialogFrameProps, "variant" | "side"> {}

export function Modal(props: ModalProps) {
  return <DialogFrame {...props} variant="modal" />;
}

export interface SheetProps extends Omit<DialogFrameProps, "variant"> {
  side?: SheetSide;
}

export function Sheet(props: SheetProps) {
  return <DialogFrame {...props} variant="sheet" />;
}
