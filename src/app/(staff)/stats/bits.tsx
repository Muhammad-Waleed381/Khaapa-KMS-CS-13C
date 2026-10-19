"use client";

import { cx } from "@/components/ui";
import { rs } from "@/lib/money";

// Small pieces shared by the Dashboard, Day report, Shifts and Activity pages.

/** A one-row segmented control (range pickers, filters). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full overflow-x-auto rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition",
            value === o.id ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, muted, className }: { name: string; muted?: boolean; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return (
    <div
      aria-hidden
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
        muted ? "bg-muted text-ink-faint" : "bg-primary-soft text-primary",
        className,
      )}
    >
      {initials}
    </div>
  );
}

/** Whole-percent change from `before` to `now`; null when there's nothing to compare with. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/** 125 -> "2h 5m", 40 -> "40m". */
export const duration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

/** Paisa -> rupees, for chart axes. */
export const toRupees = (paisa: number) => paisa / 100;

/** Money rounded to whole rupees, for headline figures ("Rs 3,780", not "Rs 3,779.51"). */
export const rsWhole = (paisa: number | null | undefined) => rs(Math.round((paisa ?? 0) / 100) * 100);
