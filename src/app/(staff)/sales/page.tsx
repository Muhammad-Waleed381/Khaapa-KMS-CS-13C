"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Badge, Button, Card, cx, Empty, Field, Input, Modal, PageHeader, Select, StaleNote, Stat } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { addDays, fmtDate, fmtDateTime, pkDate, pkTime } from "@/lib/time";

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
  lines: { itemId: string; name: string; qty: number; unitPrice: number; cost: number; oversold: number }[];
};

type Day = {
  date: string;
  sales: Sale[];
  totals: { total: number; cash: number; online: number; count: number; voids: number };
  cashiers: { id: string; name: string }[];
};

export default function SalesPage() {
  const [date, setDate] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [userId, setUserId] = useState("");
  const [voided, setVoided] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDate(pkDate()), []);

  const qs = new URLSearchParams({ date: date ?? "" });
  if (method) qs.set("method", method);
  if (userId) qs.set("userId", userId);
  if (voided) qs.set("voided", voided);
  const { data, error, stale, reload } = useApi<Day>(date ? `/api/sales?${qs}` : null);

  const today = date !== null && date === pkDate();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Sales"
        sub={date ? fmtDate(date) : " "}
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => date && setDate(addDays(date, -1))} aria-label="Previous day">
              ‹
            </Button>
            <Input
              type="date"
              className="w-40"
              value={date ?? ""}
              max={pkDate()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button size="sm" disabled={today} onClick={() => date && setDate(addDays(date, 1))} aria-label="Next day">
              ›
            </Button>
          </div>
        }
      />
      <StaleNote stale={stale} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={rs(data?.totals.total)} />
        <Stat label="Cash" value={rs(data?.totals.cash)} />
        <Stat label="Online" value={rs(data?.totals.online)} />
        <Stat label="Sales" value={data?.totals.count ?? 0} />
        <Stat label="Voided" value={data?.totals.voids ?? 0} />
      </div>

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
      {data && !data.sales.length && <Empty>No sales on this day.</Empty>}

      <div className="space-y-2">
        {data?.sales.map((s) => {
          const expanded = open === s.id;
          return (
            <Card key={s.id} className={cx("overflow-hidden", s.voided && "opacity-60")}>
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => setOpen(expanded ? null : s.id)}
              >
                <div className="w-14 shrink-0 text-sm tabular-nums text-ink-soft">{pkTime(s.createdAt)}</div>
                <div className="min-w-0 flex-1">
                  <div className={cx("truncate text-sm font-medium", s.voided && "line-through")}>
                    {s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                    {s.cashier}
                    <Badge tone={s.method === "cash" ? "neutral" : "accent"}>{s.method === "cash" ? "Cash" : "Online"}</Badge>
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
                            {l.oversold > 0 && (
                              <span className="ml-1.5 text-xs text-warn dark:text-amber-400">{l.oversold} oversold</span>
                            )}
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
                  {s.voided ? (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                      Voided by {s.voidedBy ?? "someone"}
                      {s.voidedAt && ` on ${fmtDateTime(s.voidedAt)}`}: {s.voidReason}
                    </div>
                  ) : (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="danger" onClick={() => setVoiding(s)}>
                        <Icon name="x" /> Void sale
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <VoidModal
        sale={voiding}
        onClose={() => setVoiding(null)}
        onDone={() => {
          setVoiding(null);
          reload();
        }}
      />
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
