import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";
import { Button, IconButton, type ButtonVariant } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Native <dialog>: focus trap, Esc to close and inert background come from the platform. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className={cn("sheet overflow-hidden", className)}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
            <h2 id="modal-title" className="text-2xl">{title}</h2>
            <IconButton label="Close dialog" onClick={onClose} className="-mr-2 -mt-1"><X className="size-5" /></IconButton>
          </div>
          <div className="px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-blush-50/60 px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}

/** Confirm/cancel dialog. The confirm button shows a spinner and ignores repeat clicks while running. */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "primary", onConfirm, onClose }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      /* the caller surfaces the error (toast); keep the dialog open so the user can retry or cancel */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep as is</Button>
          <Button variant={tone} onClick={run} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-ink-2">{children}</div>
    </Modal>
  );
}
