import clsx from "clsx";

export type StatusType = "queued" | "processing" | "done" | "error";

const statusConfig: Record<StatusType, { label: string; bg: string; text: string; icon: JSX.Element }> = {
  queued: {
    label: "Queued",
    bg: "bg-[var(--dc-chip)]",
    text: "text-[var(--dc-muted)]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  processing: {
    label: "Processing",
    bg: "bg-[var(--dc-accent-bg)]",
    text: "text-[var(--dc-accent-text)]",
    icon: (
      <svg className="w-3.5 h-3.5 dc-animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
  },
  done: {
    label: "Done",
    bg: "bg-[var(--dc-success-bg)]",
    text: "text-[var(--dc-success-text)]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    bg: "bg-[var(--dc-danger-bg)]",
    text: "text-[var(--dc-danger-text)]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

export function StatusPill({ status, stage }: { status: StatusType; stage?: string }): JSX.Element {
  const config = statusConfig[status];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
        config.bg,
        config.text,
        status === "processing" && "dc-animate-pulse"
      )}
    >
      {config.icon}
      <span>{stage || config.label}</span>
    </div>
  );
}
