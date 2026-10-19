"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon, ChevronRightIcon, MoreHorizontalIcon, SmartphoneIcon } from "lucide-react";
import { ColumnChart, SplitBar, type Datum } from "@/components/charts";
import { Disclosure, EmptyState, KpiRow, KpiTile, Section } from "@/components/kit";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Field, Input, Modal, PageHeader, Select, Spinner, StaleNote } from "@/components/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate, fmtDateTime, pkTime } from "@/lib/time";
import { PeriodPicker, periodLabel, periodQuery, usePeriod } from "./period";

type Sale = {
  id: string;
  method: "cash" | "online";
  total: number;
  cost: number;
  cashReceived: number | null;
  change: number | null;
  oversold: boolean;
  preorderId: string | null;
  voided: boolean;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdAt: string;
  userId: string;
  cashier: string;
  accountId: string | null;
  account: string | null;
  accountProvider: string | null;
  lines: { itemId: string; name: string; qty: number; unitPrice: number; cost: number; oversold: number }[];
};

type Totals = { total: number; cash: number; online: number; count: number; voids: number };

type Data = {
  from: string;
  to: string;
  totals: Totals;
  accounts: { accountId: string | null; label: string | null; provider: string | null; total: number; count: number }[];
  days: (Totals & { date: string })[];
  cashiers: { id: string; name: string }[];
  /** Only for a single-day period. */
  sales: Sale[] | null;
};

export default function SalesPage() {
  const [period, setPeriod] = usePeriod("today");
  const [method, setMethod] = useState("");
  const [userId, setUserId] = useState("");
  const [voided, setVoided] = useState("");
  const [voiding, setVoiding] = useState<Sale | null>(null);
  // Bumped after a void so open day lists reload too.
  const [version, setVersion] = useState(0);

  const filters = new URLSearchParams();
  if (method) filters.set("method", method);
  if (userId) filters.set("userId", userId);
  if (voided) filters.set("voided", voided);
  const { data, error, stale, reload } = useApi<Data>(period ? `/api/sales?${periodQuery(period)}&${filters}` : null);
  const single = period !== null && period.from === period.to;

  const activeFilters = [method, userId, voided].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <PageHeader title="Sales" sub={period ? `Everything sold ${period.from === period.to ? "on" : "from"} ${periodLabel(period)}.` : " "} />
        <div className="-mt-2">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>
      <StaleNote stale={stale} />

      <KpiRow>
        <KpiTile label="Total sold" value={rs(data?.totals.total)} hint={data?.totals.voids ? `${data.totals.voids} voided, not counted` : undefined} />
        <KpiTile label="Cash" value={rs(data?.totals.cash)} />
        <KpiTile label="Online" value={rs(data?.totals.online)} />
        <KpiTile label="Sales" value={data?.totals.count ?? 0} />
      </KpiRow>

      {data && data.totals.count > 0 && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-3">
            <h2 className="text-base font-semibold">{single ? "Sales by hour" : "Sales by day"}</h2>
            <p className="text-sm text-ink-soft">{single ? "When customers bought." : "Money taken each day."}</p>
            {/* Room for the top axis label, which sits above the plot. */}
            <div className="pt-8">
              <SalesChart data={data} single={single} />
            </div>
          </div>
          <div className="space-y-6 rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
            <div>
              <h2 className="mb-3 text-base font-semibold">Cash or online</h2>
              <SplitBar
                format={rs}
                parts={[
                  { label: "Cash", value: data.totals.cash },
                  { label: "Online", value: data.totals.online },
                ]}
              />
            </div>
            {data.accounts.length > 0 && (
              <div>
                <h2 className="text-base font-semibold">Online money went to</h2>
                <p className="mb-3 text-sm text-ink-soft">Each account and how much it received.</p>
                <SplitBar
                  format={rs}
                  parts={data.accounts.map((a, idx) => ({
                    label: a.accountId ? `${a.label}${a.provider ? ` (${a.provider})` : ""}` : "Not recorded",
                    value: a.total,
                    color: a.accountId ? ["var(--series-1)", "var(--series-2)", "var(--series-3)"][idx] ?? "var(--series-muted)" : "var(--series-muted)",
                  }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <Section
        title={single ? "Every sale" : "Day by day"}
        description={single ? "Tap a sale to see what was in it." : "Open a day to see its sales."}
        action={
          <span className="text-xs text-ink-faint">{activeFilters ? `${activeFilters} filter${activeFilters > 1 ? "s" : ""} on` : ""}</span>
        }
      >
        <Disclosure summary={activeFilters ? `Filters (${activeFilters} on)` : "Filter by payment, cashier or voided"}>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment">
              <option value="">Cash and online</option>
              <option value="cash">Cash only</option>
              <option value="online">Online only</option>
            </Select>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Cashier">
              <option value="">Every cashier</option>
              {data?.cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={voided} onChange={(e) => setVoided(e.target.value)} aria-label="Voided">
              <option value="">Include voided</option>
              <option value="0">Hide voided</option>
              <option value="1">Voided only</option>
            </Select>
          </div>
        </Disclosure>

        {error && !data && <EmptyState title="Couldn't load sales" description={error} />}
        {data && !data.days.length && <EmptyState title="No sales in this period" description="Pick another day or period above." />}

        {single ? (
          <SaleList sales={data?.sales ?? []} onVoid={setVoiding} />
        ) : (
          <DayList days={data?.days ?? []} version={version} filters={filters.toString()} onVoid={setVoiding} />
        )}
      </Section>

      <VoidModal
        sale={voiding}
        onClose={() => setVoiding(null)}
        onDone={() => {
          setVoiding(null);
          setVersion((v) => v + 1);
          reload();
        }}
      />
    </div>
  );
}

/** Per hour for one day (from the sales themselves), per day for a longer period. */
function SalesChart({ data, single }: { data: Data; single: boolean }) {
  const points = useMemo<Datum[]>(() => {
    if (!single) {
      return data.days
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({ label: d.date.slice(8), hint: fmtDate(d.date), values: { total: d.total } }));
    }
    const byHour = new Map<number, number>();
    for (const s of data.sales ?? []) {
      if (s.voided) continue;
      const h = Number(pkTime(s.createdAt).slice(0, 2));
      byHour.set(h, (byHour.get(h) ?? 0) + s.total);
    }
    const hours = [...byHour.keys()];
    const from = Math.min(9, ...hours);
    const to = Math.max(17, ...hours);
    return Array.from({ length: to - from + 1 }, (_, i) => {
      const h = from + i;
      return { label: fmtClock(`${String(h).padStart(2, "0")}:00`).replace(":00", ""), hint: `${fmtClock(`${String(h).padStart(2, "0")}:00`)} – ${fmtClock(`${String(h + 1).padStart(2, "0")}:00`)}`, values: { total: byHour.get(h) ?? 0 } };
    });
  }, [data, single]);
  return <ColumnChart data={points} series={[{ key: "total", label: "Sold" }]} format={rs} toAxis={(v) => v / 100} />;
}

const SHOW_DAYS = 7;

function DayList({ days, version, filters, onVoid }: { days: Data["days"]; version: number; filters: string; onVoid: (s: Sale) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? days : days.slice(0, SHOW_DAYS);
  return (
    <div className="space-y-2">
      {shown.map((d) => (
        <DayGroup key={`${d.date}-${version}`} day={d} filters={filters} onVoid={onVoid} />
      ))}
      {days.length > SHOW_DAYS && (
        <button onClick={() => setAll(!all)} className="w-full rounded-xl py-2.5 text-sm font-medium text-primary hover:bg-muted">
          {all ? "Show fewer days" : `Show all ${days.length} days`}
        </button>
      )}
    </div>
  );
}

/** One day in a multi-day period: subtotals, opening to that day's sales. */
function DayGroup({ day, filters, onVoid }: { day: Data["days"][number]; filters: string; onVoid: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-muted/50" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRightIcon className={cx("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-90")} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{fmtDate(day.date)}</div>
          <div className="mt-0.5 text-xs text-ink-soft tabular-nums">
            {day.count} sales{day.voids > 0 && ` · ${day.voids} voided`}
          </div>
        </div>
        <div className="hidden text-right text-xs text-ink-soft tabular-nums sm:block">
          <div>Cash {rs(day.cash)}</div>
          <div>Online {rs(day.online)}</div>
        </div>
        <div className="w-24 text-right text-base font-semibold tabular-nums">{rs(day.total)}</div>
      </button>
      {open && <DaySales date={day.date} filters={filters} onVoid={onVoid} />}
    </div>
  );
}

function DaySales({ date, filters, onVoid }: { date: string; filters: string; onVoid: (s: Sale) => void }) {
  const { data, error } = useApi<Data>(`/api/sales?date=${date}&${filters}`);
  return (
    <div className="border-t border-line bg-muted/30 p-2">
      {!data ? (
        error ? (
          <p className="p-4 text-sm text-ink-soft">{error}</p>
        ) : (
          <div className="grid place-items-center py-4">
            <Spinner />
          </div>
        )
      ) : (
        <SaleList sales={data.sales ?? []} onVoid={onVoid} />
      )}
    </div>
  );
}

const SHOW = 12;

function SaleList({ sales, onVoid }: { sales: Sale[]; onVoid: (s: Sale) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = all ? sales : sales.slice(0, SHOW);
  return (
    <div className="space-y-1.5">
      {shown.map((s) => (
        <SaleRow key={s.id} sale={s} expanded={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onVoid={onVoid} />
      ))}
      {sales.length > SHOW && (
        <button onClick={() => setAll(!all)} className="w-full rounded-xl py-2.5 text-sm font-medium text-primary hover:bg-muted">
          {all ? "Show fewer" : `Show all ${sales.length} sales`}
        </button>
      )}
    </div>
  );
}

function Method({ sale: s }: { sale: Sale }) {
  const PayIcon = s.method === "cash" ? BanknoteIcon : SmartphoneIcon;
  return (
    <span className="inline-flex items-center gap-1">
      <PayIcon className="size-3.5" />
      {s.method === "cash" ? "Cash" : s.account ? `Online · ${s.account}` : "Online"}
    </span>
  );
}

function SaleRow({ sale: s, expanded, onToggle, onVoid }: { sale: Sale; expanded: boolean; onToggle: () => void; onVoid: (s: Sale) => void }) {
  const units = s.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div className={cx("rounded-xl border border-line bg-surface", s.voided && "bg-muted/40")}>
      <div className="flex items-center gap-2 pr-2">
        <button className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left" onClick={onToggle} aria-expanded={expanded}>
          <div className="w-16 shrink-0 text-sm tabular-nums text-ink-soft">{fmtClock(pkTime(s.createdAt))}</div>
          <div className="min-w-0 flex-1">
            <div className={cx("truncate text-sm font-medium", s.voided && "text-ink-soft line-through")}>
              {s.lines.length === 1 ? `${s.lines[0].qty}× ${s.lines[0].name}` : `${s.lines[0].name} + ${units - s.lines[0].qty} more`}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
              <Method sale={s} />
              <span>· {s.cashier}</span>
              {s.preorderId && <Badge>Pre-order</Badge>}
              {s.oversold && <Badge tone="warn">Oversold</Badge>}
              {s.voided && <Badge tone="bad">Voided</Badge>}
            </div>
          </div>
          <div className={cx("shrink-0 text-base font-semibold tabular-nums", s.voided && "text-ink-faint line-through")}>{rs(s.total)}</div>
        </button>
        {!s.voided && (
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-muted hover:text-ink" aria-label="Sale actions">
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggle}>{expanded ? "Hide details" : "See details"}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onVoid(s)}>
                Void sale…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
          <ul className="space-y-1">
            {s.lines.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span>
                  {l.qty}× {l.name}
                  <span className="ml-1.5 text-xs text-ink-faint">{rs(l.unitPrice)} each</span>
                  {l.oversold > 0 && <span className="ml-1.5 text-xs text-warn">{l.oversold} sold while out of stock</span>}
                </span>
                <span className="tabular-nums">{rs(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>
          {s.method === "cash" && s.cashReceived !== null && (
            <p className="text-xs text-ink-soft">
              Customer gave {rs(s.cashReceived)}, got {rs(s.change)} back.
            </p>
          )}
          {s.method === "online" && (
            <p className="text-xs text-ink-soft">
              {s.account ? `Paid to ${s.account}${s.accountProvider ? ` (${s.accountProvider})` : ""}.` : "Receiving account not recorded."}
            </p>
          )}
          {s.voided && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Voided by {s.voidedBy ?? "someone"}
              {s.voidedAt && ` on ${fmtDateTime(s.voidedAt)}`}: {s.voidReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VoidModal({ sale, onClose, onDone }: { sale: Sale | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;
    setBusy(true);
    try {
      await api(`/api/sales/${sale.id}/void`, { body: { reason } });
      toast("Sale voided, stock returned");
      setReason("");
      onDone();
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!sale} onClose={onClose} title="Void this sale?">
      {sale && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-soft">
            {sale.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}, {rs(sale.total)} ({sale.method}). The items go
            back into stock. Your name is logged with the void.
          </p>
          <Field label="Reason">
            <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rang up twice, wrong item…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy || reason.trim().length < 2}>
              {busy ? "Voiding…" : "Void sale"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
