"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

// Small, dependency-free charts for the staff app. Rules they follow:
// - colours come from --series-1..3 (validated for colour-blind readers), in
//   that order, and --series-muted for context data; text is never coloured;
// - bars are at most 24px wide with a 4px rounded end, on hairline gridlines;
// - every mark has a hover/tap tooltip; a legend appears for two series.

export type Series = { key: string; label: string; color?: string };
export type Datum = { label: string; hint?: string; values: Record<string, number> };

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

/** Round a maximum up to a clean axis top (1, 2, 2.5, 5, 10 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** 1200 -> 1.2K, 1500000 -> 1.5M (for axis ticks only). */
function compact(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return `${+v.toFixed(0)}`;
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="font-medium text-ink tabular-nums">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * Columns over time or categories. One series = one colour, no legend (the
 * title says what it is). Two series sit side by side with a legend.
 * `toAxis` converts a raw value to the axis unit (e.g. paisa -> rupees).
 */
export function ColumnChart({
  data,
  series,
  format,
  toAxis = (v) => v,
  height = 180,
  labelEvery,
  className,
}: {
  data: Datum[];
  series: Series[];
  format: (v: number) => string;
  toAxis?: (v: number) => number;
  height?: number;
  /** Show every nth x label (auto when omitted). */
  labelEvery?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const colors = series.map((s, i) => s.color ?? SERIES_COLORS[i]);
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => toAxis(d.values[s.key] ?? 0)))));
  const ticks = [0, max / 2, max];
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8));
  const barW = series.length > 1 ? "min(12px, 40%)" : "min(24px, 70%)";

  return (
    <div className={cx("space-y-3", className)}>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />}
      <div className="flex gap-2">
        {/* y axis */}
        <div className="relative w-9 shrink-0 text-right text-[11px] text-ink-faint tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {data.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${d.label}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(", ")}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                  className={cx(
                    "relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none",
                    hover === i && "bg-muted/60",
                  )}
                >
                  {series.map((s, si) => {
                    const v = toAxis(d.values[s.key] ?? 0);
                    return (
                      <span
                        key={s.key}
                        className="block rounded-t-[4px]"
                        style={{ width: barW, height: `${Math.max(0, (v / max) * 100)}%`, background: colors[si] }}
                      />
                    );
                  })}
                </button>
              ))}
            </div>
            {hover !== null && data[hover] && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-popover px-2.5 py-1.5 text-xs shadow-md"
                style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
              >
                <div className="font-medium text-ink">{data[hover].hint ?? data[hover].label}</div>
                {series.map((s, si) => (
                  <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-ink-soft">
                    <span className="size-2 rounded-sm" style={{ background: colors[si] }} />
                    {series.length > 1 && <span>{s.label}</span>}
                    <span className="font-medium text-ink tabular-nums">{format(data[hover].values[s.key] ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* x labels */}
          <div className="mt-1.5 flex text-[11px] text-ink-faint">
            {data.map((d, i) => (
              <span key={i} className="flex-1 truncate text-center">
                {i % every === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ranked horizontal bars: "which items sold most". Value at the bar's tip. */
export function BarList({
  rows,
  format,
  color = "var(--series-1)",
  max: maxRows,
}: {
  rows: { label: ReactNode; value: number; hint?: ReactNode }[];
  format: (v: number) => string;
  color?: string;
  max?: number;
}) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  const top = Math.max(1, ...shown.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {shown.map((r, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: color }} />
          </div>
          {r.hint && <div className="mt-0.5 text-xs text-ink-faint">{r.hint}</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Part-to-whole in one bar: cash vs online, money per account. Segments are
 * separated by a 2px surface gap; the legend carries values and shares.
 */
export function SplitBar({
  parts,
  format,
  height = 14,
}: {
  parts: { label: string; value: number; color?: string }[];
  format: (v: number) => string;
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const colored = parts.map((p, i) => ({ ...p, color: p.color ?? SERIES_COLORS[i] ?? "var(--series-muted)" }));
  return (
    <div className="space-y-2.5">
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-muted" style={{ height }}>
        {total > 0 &&
          colored
            .filter((p) => p.value > 0)
            .map((p) => (
              <div
                key={p.label}
                title={`${p.label}: ${format(p.value)}`}
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              />
            ))}
      </div>
      <Legend
        items={colored.map((p) => ({
          label: p.label,
          color: p.color,
          value: `${format(p.value)}${total > 0 ? ` · ${Math.round((p.value / total) * 100)}%` : ""}`,
        }))}
      />
    </div>
  );
}

/** A tiny trend line for a stat tile. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const y = (v: number) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cx("h-7 w-full", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Progress toward a limit, e.g. shares sold out of shares on offer. */
export function Meter({ value, max, label, format = (v) => `${v}` }: { value: number; max: number; label?: ReactNode; format?: (v: number) => string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-soft">{label}</span>
          <span className="font-medium tabular-nums">
            {format(value)} <span className="text-ink-faint">/ {format(max)}</span>
          </span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-muted">
        <div className="h-2.5 rounded-full bg-[var(--series-1)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
