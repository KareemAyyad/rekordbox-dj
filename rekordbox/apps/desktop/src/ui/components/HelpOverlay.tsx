import { Badge } from "./ui";

export function HelpOverlay(): JSX.Element {
  return (
    <div className="fixed bottom-5 right-5 z-30 max-w-sm rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-[var(--dc-shadow-pop)] backdrop-blur-[var(--dc-blur)]">
      <div className="text-sm font-semibold tracking-tight">Help Mode</div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--dc-muted)]">
        Hover or click any <Badge className="px-1.5 py-0.5 text-[10px] font-semibold">?</Badge> badge to see what it means.
      </div>
      <div className="mt-2 text-[10px] font-semibold text-[var(--dc-muted2)]">Exit: Esc or Ctrl/⌘ + ?</div>
    </div>
  );
}
