import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

import { Icon, type IconName } from "./Icon";
import { Notice } from "./ui";

interface ModalProps {
  title: string;
  icon?: IconName;
  /** "danger" for actions that discard or reject something. */
  tone?: "default" | "danger";
  children: ReactNode;
  footer: ReactNode;
  /** Receives focus when the dialog opens: the safest choice, usually Cancel. */
  initialFocus: RefObject<HTMLButtonElement | null>;
  /** Esc and the browser's close request; ignored while `busy`. */
  onClose: () => void;
  busy?: boolean;
}

/**
 * A modal built on <dialog>: the browser keeps focus inside it and Esc closes it. Focus goes back
 * to the control that opened it. Mount it only while it should be shown.
 */
export function Modal({ title, icon = "info", tone = "default", children, footer, initialFocus, onClose, busy = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // jsdom (tests) has no showModal; the open attribute is enough there.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    initialFocus.current?.focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      opener?.focus();
    };
    // Runs once per opening: the dialog is mounted only while shown.
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog${tone === "danger" ? " danger" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault(); // let React decide, and never close mid-request
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <div className="dialog-icon">
          <Icon name={icon} />
        </div>
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="dialog-body" id={bodyId}>
        {children}
      </div>
      <div className="dialog-footer">{footer}</div>
    </dialog>
  );
}

interface ConfirmProps {
  title: string;
  icon?: IconName;
  tone?: "default" | "danger";
  children: ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while the request runs. */
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** Why the last attempt failed; the dialog stays open so the operator can retry or cancel. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before a significant action. Focus starts on Cancel, so a reflex Enter never confirms. */
export function ConfirmDialog({
  title,
  icon,
  tone = "default",
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      title={title}
      icon={icon}
      tone={tone}
      initialFocus={cancelRef}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && (
        <Notice tone="error" live="alert">
          {error}
        </Notice>
      )}
    </Modal>
  );
}
