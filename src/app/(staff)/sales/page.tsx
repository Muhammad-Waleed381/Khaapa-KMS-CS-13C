"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Badge, Button, Card, cx, Empty, Field, Input, Modal, PageHeader, Select, Spinner, StaleNote, Stat } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtDate, fmtDateTime, pkTime } from "@/lib/time";
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

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Sales" sub={period ? periodLabel(period) : " "} actions={<PeriodPicker value={period} onChange={setPeriod} />} />
      <StaleNote stale={stale} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={rs(data?.totals.total)} />
        <Stat label="Cash" value={rs(data?.totals.cash)} />
        <Stat label="Online" value={rs(data?.totals.online)} />
        <Stat label="Sales" value={data?.totals.count ?? 0} />
        <Stat label="Voided" value={data?.totals.voids ?? 0} />
      </div>

      {data && data.accounts.length > 0 && <AccountsCard accounts={data.accounts} />}

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All payments</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </Select>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">All cashiers</option>
          {data?.cashiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={voided} onChange={(e) => setVoided(e.target.value)}>
          <option value="">Voided + not</option>
          <option value="0">Not voided</option>
          <option value="1">Voided only</option>
        </Select>
      </div>

      {error && !data && <Empty>{error}</Empty>}
      {data && !data.days.length && <Empty>No sales in this period.</Empty>}

      {single ? (
        <SaleList sales={data?.sales ?? []} onVoid={setVoiding} />
      ) : (
        <div className="space-y-2">
          {data?.days.map((d) => (
            <DayGroup key={`${d.date}-${version}`} day={d} filters={filters.toString()} onVoid={setVoiding} />
          ))}
        </div>
      )}

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

/** Where the online money went. Sales from before accounts were tracked show as "Not recorded". */
function AccountsCard({ accounts }: { accounts: Data["accounts"] }) {
  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-2 text-sm font-semibold">Online money by account</h2>
      <ul className="divide-y divide-line text-sm">
        {accounts.map((a) => (
          <li key={a.accountId ?? "none"} className="flex items-center justify-between gap-4 py-1.5">
            <span className={cx(!a.accountId && "text-muted-foreground")}>
              {a.accountId ? (
                <>
                  {a.label}
                  {a.provider && <span className="text-ink-faint"> · {a.provider}</span>}
                </>
              ) : (
                "Not recorded"
              )}
              <span className="ml-2 text-xs text-ink-faint">{a.count} sales</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{rs(a.total)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** One day in a multi-day period: subtotals, opening to that day's sales. */
function DayGroup({ day, filters, onVoid }: { day: Data["days"][number]; filters: string; onVoid: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <span className={cx("text-ink-faint transition-transform", open && "rotate-90")}>›</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{fmtDate(day.date)}</div>
          <div className="mt-0.5 text-xs text-ink-faint tabular-nums">
            {day.count} sales · cash {rs(day.cash)} · online {rs(day.online)}
            {day.voids > 0 && ` · ${day.voids} voided`}
          </div>
        </div>
        <div className="text-sm font-semibold tabular-nums">{rs(day.total)}</div>
      </button>
      {open && <DaySales date={day.date} filters={filters} onVoid={onVoid} />}
    </Card>
  );
}

function DaySales({ date, filters, onVoid }: { date: string; filters: string; onVoid: (s: Sale) => void }) {
  const { data, error } = useApi<Data>(`/api/sales?date=${date}&${filters}`);
  return (
    <div className="border-t border-line bg-muted/30 p-2">
      {!data ? error ? <Empty>{error}</Empty> : <div className="grid place-items-center py-4"><Spinner /></div> : <SaleList sales={data.sales ?? []} onVoid={onVoid} />}
    </div>
  );
}

function SaleList({ sales, onVoid }: { sales: Sale[]; onVoid: (s: Sale) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {sales.map((s) => (
        <SaleCard key={s.id} sale={s} expanded={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onVoid={onVoid} />
      ))}
    </div>
  );
}

function SaleCard({ sale: s, expanded, onToggle, onVoid }: { sale: Sale; expanded: boolean; onToggle: () => void; onVoid: (s: Sale) => void }) {
  return (
    <Card className={cx("overflow-hidden", s.voided && "opacity-60")}>
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={onToggle}>
        <div className="w-14 shrink-0 text-sm tabular-nums text-ink-soft">{pkTime(s.createdAt)}</div>
        <div className="min-w-0 flex-1">
          <div className={cx("truncate text-sm font-medium", s.voided && "line-through")}>
            {s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
            {s.cashier}
            <Badge tone={s.method === "cash" ? "neutral" : "accent"}>{s.method === "cash" ? "Cash" : "Online"}</Badge>
            {s.method === "online" && s.account && <span>to {s.account}</span>}
            {s.preorderId && <Badge tone="accent">Pre-order</Badge>}
            {s.oversold && <Badge tone="warn">Oversold</Badge>}
            {s.voided && <Badge tone="bad">Voided</Badge>}
          </div>
        </div>
        <div className={cx("text-sm font-semibold tabular-nums", s.voided && "line-through")}>{rs(s.total)}</div>
      </button>

      {expanded && (
        <div className="border-t border-line bg-muted/30 px-4 py-3 text-sm">
          <table className="w-full">
            <tbody>
              {s.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-0.5">
                    {l.qty}× {l.name}
                    {l.oversold > 0 && <span className="ml-1.5 text-xs text-warn">{l.oversold} oversold</span>}
                  </td>
                  <td className="py-0.5 text-right tabular-nums text-ink-soft">{rs(l.unitPrice)} each</td>
                  <td className="w-24 py-0.5 text-right tabular-nums">{rs(l.qty * l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.method === "cash" && s.cashReceived !== null && (
            <div className="mt-2 flex justify-end gap-4 text-xs text-ink-soft">
              <span>Received {rs(s.cashReceived)}</span>
              <span>Change {rs(s.change)}</span>
            </div>
          )}
          {s.method === "online" && (
            <div className="mt-2 flex justify-end text-xs text-ink-soft">
              {s.account ? `Paid to ${s.account}${s.accountProvider ? ` (${s.accountProvider})` : ""}` : "Receiving account not recorded"}
            </div>
          )}
          {s.voided ? (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Voided by {s.voidedBy ?? "someone"}
              {s.voidedAt && ` on ${fmtDateTime(s.voidedAt)}`}: {s.voidReason}
            </div>
          ) : (
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="danger" onClick={() => onVoid(s)}>
                <Icon name="x" /> Void sale
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
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
