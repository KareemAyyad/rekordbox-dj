import { createContext, useContext, useId, useMemo, useState } from "react";
import clsx from "clsx";

type TooltipContextValue = { helpMode: boolean };

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function TooltipProvider(props: { value: TooltipContextValue; children: React.ReactNode }): JSX.Element {
  return <TooltipContext.Provider value={props.value}>{props.children}</TooltipContext.Provider>;
}

export function useTooltipContext(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error("TooltipProvider missing");
  return ctx;
}

export function Tooltip(props: { title: string; body: string; children: React.ReactElement; learnMoreHref?: string }): JSX.Element {
  const { helpMode } = useTooltipContext();
  const id = useId();
  const [open, setOpen] = useState(false);
  const shouldShow = open;

  const content = useMemo(
    () => (
      <div
        role="tooltip"
        id={id}
        className={clsx(
          "absolute left-0 top-full z-50 mt-2 w-[300px] origin-top-left rounded-2xl border p-4 shadow-[var(--dc-shadow)] backdrop-blur-[var(--dc-blur)]",
          "before:absolute before:-top-2 before:left-6 before:h-3 before:w-3 before:rotate-45 before:rounded-sm before:border before:border-[color:var(--dc-tooltip-border)] before:bg-[var(--dc-tooltip)]",
          "border-[color:var(--dc-tooltip-border)] bg-[var(--dc-tooltip)] text-[var(--dc-tooltip-text)]",
          shouldShow ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0",
          "transition duration-150 ease-out"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight">{props.title}</div>
          <span className="rounded-md bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-semibold text-[var(--dc-tooltip-muted)] ring-1 ring-[color:var(--dc-border)]">
            {helpMode ? "Help" : "Tip"}
          </span>
        </div>
        <div className="mt-1 text-xs leading-relaxed text-[var(--dc-tooltip-muted)]">{props.body}</div>
        {props.learnMoreHref ? (
          <a
            className="mt-2 inline-flex text-xs font-medium text-[var(--dc-accent-text)] underline underline-offset-4"
            href={props.learnMoreHref}
            target="_blank"
            rel="noreferrer"
          >
            Learn more: {props.learnMoreHref}
          </a>
        ) : null}
        {helpMode ? <div className="mt-2 text-[10px] font-semibold text-[var(--dc-tooltip-muted)]">Click again to close.</div> : null}
      </div>
    ),
    [helpMode, id, props.body, props.learnMoreHref, props.title, shouldShow]
  );

  const handlers = helpMode
    ? {
        "aria-describedby": id,
        "aria-label": `${props.title}: ${props.body}`,
        onPointerDown: () => setOpen((v: boolean) => !v)
      }
    : {
        "aria-describedby": id,
        "aria-label": `${props.title}: ${props.body}`,
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        onPointerDown: () => setOpen((v: boolean) => !v)
      };

  return (
    <span className="relative inline-flex">
      {cloneChildWithHandlers(props.children, handlers, helpMode ? "cursor-help" : undefined)}
      {content}
    </span>
  );
}

function cloneChildWithHandlers(child: React.ReactElement, handlers: Record<string, unknown>, className?: string): React.ReactElement {
  // Minimal clone without importing `cloneElement` to keep bundle simple.
  const mergedClassName = [child.props?.className, className].filter(Boolean).join(" ");
  return { ...child, props: { ...child.props, ...handlers, ...(className ? { className: mergedClassName } : null) } };
}
