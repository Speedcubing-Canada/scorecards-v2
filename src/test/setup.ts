/**
 * jsdom 30 ships HTMLDialogElement without `showModal`/`close`, so a component that uses
 * a native modal dialog cannot be rendered in a test at all. This is the smallest shim
 * that makes `open`, Escape and `close` behave like the browser; the focus trap and
 * `::backdrop` are the real browser's job and are not simulated.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
    // The browser moves focus into the dialog; autofocus or the first tabbable wins.
    const target = this.querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea');
    target?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) return;
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}
