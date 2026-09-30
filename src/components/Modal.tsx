import { useEffect, useId, useRef } from 'react';
import ui from '../styles/ui.module.css';

/**
 * A native `<dialog>` opened with `showModal()`, which is where the modal behaviour comes
 * from: the focus trap, Escape, the inert background and restoring focus to whatever was
 * focused before are all the browser's, not ours. The hand-rolled version had none of them.
 *
 * `title` is rendered as the heading and wired up as the dialog's accessible name.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={ui.dialog}
      aria-labelledby={titleId}
      // Escape and a backdrop click both end in `close`, so one handler covers both.
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
    >
      <div className={ui.dialogBodyWrap}>
        <h2 id={titleId} className={ui.dialogTitle}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
