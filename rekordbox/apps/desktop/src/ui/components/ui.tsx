import clsx from "clsx";

/* ─────────────────────────────────────────────────────────────────────────────
   Spinner - Premium loading indicator
   ───────────────────────────────────────────────────────────────────────────── */
export function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }): JSX.Element {
  const sizes = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-8 h-8" };
  return (
    <svg
      className={clsx(sizes[size], "dc-animate-spin text-[var(--dc-accent)]", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function Card(props: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <section
      className={clsx(
        "rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-5 shadow-[var(--dc-shadow)] backdrop-blur-[var(--dc-blur)]",
        "transition-[box-shadow,background-color,border-color] duration-200",
        props.className
      )}
    >
      {props.children}
    </section>
  );
}

export function Panel(props: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <div className={clsx("rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-4", props.className)}>{props.children}</div>
  );
}

export function Button(props: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}): JSX.Element {
  const variant = props.variant ?? "secondary";
  const size = props.size ?? "md";
  const iconPosition = props.iconPosition ?? "left";
  const isDisabled = props.disabled || props.loading;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold ring-1 ring-inset transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  const variants: Record<string, string> = {
    primary: "bg-[var(--dc-accent)] text-[var(--dc-accent-contrast)] ring-transparent hover:bg-[var(--dc-accent-light)] focus-visible:ring-[color:var(--dc-accent)]",
    secondary: "bg-[var(--dc-chip)] text-[var(--dc-text)] ring-[color:var(--dc-border)] hover:bg-[var(--dc-chip-strong)] focus-visible:ring-[color:var(--dc-accent)]",
    danger: "bg-[var(--dc-danger-bg)] text-[var(--dc-danger-text)] ring-[color:var(--dc-danger-border)] hover:bg-[var(--dc-danger)] hover:text-white focus-visible:ring-[color:var(--dc-danger)]",
    ghost: "bg-transparent text-[var(--dc-muted)] ring-transparent hover:bg-[var(--dc-chip)] hover:text-[var(--dc-text)] focus-visible:ring-[color:var(--dc-accent)]",
  };

  const disabledStyles = isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "active:scale-[0.98]";

  const iconEl = props.loading ? <Spinner size="sm" className="text-current" /> : props.icon;

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={isDisabled}
      title={props.title}
      className={clsx(base, sizing, variants[variant], disabledStyles, props.className)}
    >
      {iconEl && iconPosition === "left" && iconEl}
      {props.children}
      {iconEl && iconPosition === "right" && iconEl}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={clsx(
        "w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)] outline-none",
        "placeholder:text-[var(--dc-muted2)] focus:border-[color:var(--dc-border-strong)] focus:ring-2 focus:ring-[color:var(--dc-accent-ring)]",
        "transition",
        className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={clsx(
        "w-full resize-none rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] p-4 text-sm text-[var(--dc-text)] outline-none",
        "placeholder:text-[var(--dc-muted2)] focus:border-[color:var(--dc-border-strong)] focus:ring-2 focus:ring-[color:var(--dc-accent-ring)]",
        "transition",
        className
      )}
    />
  );
}

export function Badge(props: { children: React.ReactNode; className?: string }): JSX.Element {
  return <span className={clsx("rounded-lg bg-[var(--dc-chip)] px-2 py-1 text-xs text-[var(--dc-muted)] ring-1 ring-[color:var(--dc-border)]", props.className)}>{props.children}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FormField - Label + input wrapper with error state
   ───────────────────────────────────────────────────────────────────────────── */
export function FormField(props: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={clsx("flex flex-col gap-1.5", props.className)}>
      <label className="text-sm font-medium text-[var(--dc-text)]">
        {props.label}
        {props.hint && <span className="ml-1 font-normal text-[var(--dc-muted2)]">({props.hint})</span>}
      </label>
      {props.children}
      {props.error && (
        <p className="text-xs font-medium text-[var(--dc-danger-text)] flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {props.error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   NumberInput - Numeric input with unit suffix
   ───────────────────────────────────────────────────────────────────────────── */
export function NumberInput(props: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div className={clsx("relative flex items-center", props.className)}>
      <input
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        disabled={props.disabled}
        className={clsx(
          "w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)] outline-none",
          "placeholder:text-[var(--dc-muted2)] focus:border-[color:var(--dc-border-strong)] focus:ring-2 focus:ring-[color:var(--dc-accent-ring)]",
          "transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          props.unit && "pr-12",
          props.disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {props.unit && (
        <span className="absolute right-3 text-sm text-[var(--dc-muted2)] pointer-events-none">{props.unit}</span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Checkbox - Toggle checkbox with label
   ───────────────────────────────────────────────────────────────────────────── */
export function Checkbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <label className={clsx("inline-flex items-center gap-2 cursor-pointer", props.disabled && "opacity-50 cursor-not-allowed", props.className)}>
      <div className="relative">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          disabled={props.disabled}
          className="sr-only peer"
        />
        <div className={clsx(
          "w-5 h-5 rounded-md border-2 transition-all",
          "border-[color:var(--dc-border-strong)] bg-[var(--dc-input)]",
          "peer-checked:bg-[var(--dc-accent)] peer-checked:border-[color:var(--dc-accent)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--dc-accent-ring)] peer-focus-visible:ring-offset-2"
        )} />
        <svg
          className="absolute inset-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity p-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      {props.label && <span className="text-sm text-[var(--dc-text)]">{props.label}</span>}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Skeleton - Premium loading placeholder
   ───────────────────────────────────────────────────────────────────────────── */
export function Skeleton(props: { className?: string }): JSX.Element {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-lg bg-[var(--dc-chip)]",
        props.className
      )}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Select - Native select with custom styling
   ───────────────────────────────────────────────────────────────────────────── */
export function Select(props: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div className={clsx("relative", props.className)}>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className={clsx(
          "w-full appearance-none rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 pr-10 text-sm text-[var(--dc-text)] outline-none",
          "focus:border-[color:var(--dc-border-strong)] focus:ring-2 focus:ring-[color:var(--dc-accent-ring)]",
          "transition cursor-pointer",
          props.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {props.placeholder && (
          <option value="" disabled>{props.placeholder}</option>
        )}
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-muted2)] pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
