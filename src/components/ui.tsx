"use client";

import { useEffect, type ComponentProps, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        { sm: "min-h-8 px-2.5 text-xs", md: "min-h-9 px-3 text-sm", lg: "min-h-11 px-5 text-base" }[size],
        {
          primary: "bg-accent text-white shadow-sm hover:bg-accent/90",
          secondary: "border border-line bg-surface text-ink shadow-sm hover:bg-muted",
          ghost: "text-ink-soft hover:bg-muted hover:text-ink",
          danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
        }[variant],
        className,
      )}
      {...p}
    />
  );
}

const fieldCls =
  "w-full min-h-9 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(fieldCls, className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldCls, "min-h-20", className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(fieldCls, className)} {...p} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "accent";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        {
          neutral: "bg-muted text-ink-soft",
          good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
          warn: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
          bad: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
          accent: "bg-accent-soft text-accent",
        }[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. Esc closes. */
export function Modal({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cx(
          "rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-faint hover:bg-muted hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Page heading with optional actions on the right. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">{children}</div>;
}

export function Spinner() {
  return <div className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </Card>
  );
}

/** Shows when a useApi page is displaying cached data because the network failed. */
export function StaleNote({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      Offline: showing the last saved copy.
    </div>
  );
}
