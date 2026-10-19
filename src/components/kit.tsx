"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Sparkline } from "@/components/charts";
import { cx } from "@/components/ui";

// Calm page building blocks. A page should read top to bottom as:
// one-line explanation -> the few numbers that matter -> one picture ->
// the main action -> details folded away. See docs/ui-guidelines.md.

/** A titled block with breathing room. `description` is one plain sentence. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 max-w-prose text-sm text-ink-soft">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "What is this page for", in one or two short sentences, with an info mark. */
export function Explainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink-soft", className)}>
      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
      <div className="max-w-prose">{children}</div>
    </div>
  );
}

/**
 * One headline number. `delta` is signed (e.g. +12 for "12% more"); it is
 * shown with an arrow and words, never colour alone.
 */
export function KpiTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  trend,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: ReactNode;
  hint?: ReactNode;
  trend?: number[];
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-ink sm:text-3xl">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-soft">
          <span
            className={cx(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
              delta > 0 && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
              delta < 0 && "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
              delta === 0 && "bg-muted text-ink-soft",
            )}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)}%
          </span>
          {deltaLabel}
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-ink-faint">{hint}</div>}
      {trend && trend.length > 1 && <Sparkline values={trend} className="mt-3" />}
    </div>
  );
}

/** 2 columns on phones, up to 4 on wide screens. Keep it to 4 tiles or fewer. */
export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** The one big thing to do on a page ("Buy your shares", "Start shift"). */
export function ActionCard({
  title,
  description,
  cta,
  href,
  onClick,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  cta: ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[.98]";
  return (
    <div className={cx("flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary-soft/60 p-5 sm:flex-row sm:items-center sm:p-6", className)}>
      {icon && <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold text-ink">{title}</div>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {href ? (
        <Link href={href} className={button}>
          {cta}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={button}>
          {cta}
        </button>
      )}
    </div>
  );
}

/** Numbered steps for a flow. `current` is the 0-based active step. */
export function Steps({ steps, current, className }: { steps: { title: ReactNode; description?: ReactNode }[]; current: number; className?: string }) {
  return (
    <ol className={cx("grid gap-3 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "later";
        return (
          <li key={i} className="flex gap-3 sm:flex-col sm:gap-2">
            <div className="flex items-center gap-2 sm:w-full">
              <span
                className={cx(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "now" && "bg-primary-soft text-primary ring-2 ring-primary",
                  state === "later" && "bg-muted text-ink-faint",
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={cx("hidden h-px flex-1 sm:block", i === steps.length - 1 ? "bg-transparent" : "bg-line")} />
            </div>
            <div>
              <div className={cx("text-sm font-medium", state === "later" ? "text-ink-faint" : "text-ink")}>{s.title}</div>
              {s.description && <div className="text-xs text-ink-soft">{s.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Secondary details, closed by default. */
export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-ink"
      >
        {summary}
        <svg viewBox="0 0 24 24" className={cx("size-4 text-ink-faint transition", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="border-t border-line px-4 py-4">{children}</div>}
    </div>
  );
}

/** A friendly empty state with an optional next step. */
export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-base font-medium text-ink">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
