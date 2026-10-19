import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function ToolDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  closeRef.current = onClose;
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]',
          ) ?? []),
        ].filter((item) => item.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    panel.current?.addEventListener("keydown", keydown);
    const current = panel.current;
    return () => {
      current?.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div className="tool-drawer-backdrop" onClick={onClose}>
      <section
        ref={panel}
        className="tool-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭工具面板"
            title="关闭（Esc）"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
