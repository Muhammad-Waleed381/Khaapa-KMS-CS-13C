"use client";

import { useEffect, useState } from "react";
import { Disclosure, EmptyState, Explainer, Section } from "@/components/kit";
import { STATUS_LABEL, type DayStatus, type PreorderLine, type PreorderStatus } from "@/components/public/types";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Empty, Input, Modal, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { addDays, fmtClock, fmtDate, fmtDateTime, pkDate } from "@/lib/time";

type Order = {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  note: string | null;
  pickupDate: string;
  lines: PreorderLine[];
  total: number;
  status: PreorderStatus;
  paymentRef: string | null;
  hasProof: boolean;
  /** "Shop main (NayaPay ••1234)": where the customer was asked to pay. */
  account: string | null;
  createdAt: string;
};

type Action = "paid" | "ready" | "collected" | "cancelled";

/** The board's columns, in the order an order moves through them. */
const COLUMNS: { status: PreorderStatus; title: string; hint: string }[] = [
  { status: "awaiting_payment", title: "Waiting for payment", hint: "Check the screenshot, then confirm." },
  { status: "paid", title: "Paid", hint: "Get these ready." },
  { status: "ready", title: "Ready", hint: "Waiting for the customer." },
  { status: "collected", title: "Collected", hint: "Done. Recorded as sales." },
];

const NEXT: Partial<Record<PreorderStatus, { action: Action; label: string }>> = {
  awaiting_payment: { action: "paid", label: "Payment received" },
  paid: { action: "ready", label: "Mark ready" },
  ready: { action: "collected", label: "Handed over" },
};

export default function OrdersPage() {
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [proofOf, setProofOf] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const d = pkDate();
    /* eslint-disable react-hooks/set-state-in-effect */
    setToday(d);
    setDate(d);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const { data, loading, stale, reload } = useApi<{ orders: Order[] }>(date ? `/api/preorders?date=${date}` : null);
  const orders = data?.orders ?? [];
  const cancelled = orders.filter((o) => o.status === "cancelled");

  async function move(o: Order, status: Action) {
    if (status === "cancelled" && !confirm(`Cancel pre-order ${o.code}?`)) return;
    setBusy(o.id);
    try {
      await api(`/api/preorders/${o.id}/status`, { body: { status } });
      toast(status === "collected" ? `${o.code} handed over, sale recorded` : `${o.code}: ${STATUS_LABEL[status]}`);
      await reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Pre-orders"
        sub="Customers order ahead and pay online. Check the payment, get the order ready, hand it over."
        actions={
          <Button onClick={() => reload()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <StaleNote stale={stale} />

      {today && <DaySettings today={today} />}

      <Section
        title={date ? `Orders for pickup ${date === today ? "today" : fmtDate(date)}` : "Orders"}
        description="Each order moves left to right. Press the button on a card when its step is done."
        action={
          today && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-muted p-0.5">
                {[addDays(today, -1), today, addDays(today, 1)].map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={cx(
                      "rounded-md px-3 py-1.5 text-sm font-medium",
                      date === d ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {["Yesterday", "Today", "Tomorrow"][i]}
                  </button>
                ))}
              </div>
              <Input type="date" aria-label="Pickup date" value={date ?? ""} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
            </div>
          )
        }
      >
        {loading && !data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title="No pre-orders for this day" description="When customers order ahead, their orders show up here." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => o.status === col.status);
              return (
                <div key={col.status} className="rounded-2xl bg-muted/50 p-3">
                  <div className="mb-3 px-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{col.title}</h3>
                      <span className="grid min-w-6 place-items-center rounded-full bg-surface px-1.5 text-xs font-semibold tabular-nums">{list.length}</span>
                    </div>
                    <p className="text-xs text-ink-soft">{col.hint}</p>
                  </div>
                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">Nothing here</p>
                    ) : (
                      list.map((o) => (
                        <OrderCard key={o.id} order={o} busy={busy === o.id} onMove={(a) => move(o, a)} onProof={() => setProofOf(o)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {cancelled.length > 0 && (
          <Disclosure summary={`${cancelled.length} cancelled`}>
            <ul className="space-y-1 text-sm text-ink-soft">
              {cancelled.map((o) => (
                <li key={o.id}>
                  <span className="font-mono font-semibold text-ink">{o.code}</span> · {o.customerName} · {rs(o.total)}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </Section>

      <ProofModal order={proofOf} onClose={() => setProofOf(null)} />
    </div>
  );
}

function OrderCard({ order: o, busy, onMove, onProof }: { order: Order; busy: boolean; onMove: (a: Action) => void; onProof: () => void }) {
  const next = NEXT[o.status];
  const units = o.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{o.customerName}</div>
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="font-mono font-semibold tracking-wider text-ink">{o.code}</span>
            <a href={`tel:${o.phone}`} className="hover:text-primary">
              {o.phone}
            </a>
          </div>
        </div>
        <div className="text-right text-base font-semibold tabular-nums">{rs(o.total)}</div>
      </div>

      <ul className="space-y-0.5 text-sm">
        {o.lines.map((l) => (
          <li key={l.itemId} className="flex gap-1.5">
            <b className="tabular-nums">{l.qty}×</b>
            <span className="min-w-0 truncate">{l.name}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-ink-soft">“{o.note}”</p>}

      {o.status === "awaiting_payment" &&
        (o.hasProof ? (
          <button onClick={onProof} className="group block w-full overflow-hidden rounded-lg border border-line text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/preorders/${o.id}/proof?raw=1`} alt={`Payment screenshot for ${o.code}`} className="h-28 w-full object-cover object-top" loading="lazy" />
            <span className="block px-2.5 py-1.5 text-xs text-ink-soft group-hover:text-ink">
              Screenshot{o.account ? ` · paid to ${o.account}` : ""} · tap to enlarge
            </span>
          </button>
        ) : (
          <p className="rounded-lg bg-warn/10 px-2.5 py-2 text-xs text-warn">No screenshot yet. Wait for the customer to send it.</p>
        ))}

      {next && (
        <Button
          variant={o.status === "awaiting_payment" && !o.hasProof ? "secondary" : "primary"}
          className="w-full"
          disabled={busy}
          onClick={() => onMove(next.action)}
        >
          {next.label}
        </Button>
      )}
      {o.status === "paid" && (
        <button disabled={busy} onClick={() => onMove("collected")} className="w-full text-xs text-ink-soft hover:text-ink">
          Customer is here already? Hand over now
        </button>
      )}
      {o.status !== "collected" && (
        <div className="flex items-start justify-between gap-3 text-xs text-ink-faint">
          <span className="min-w-0">
            {units} item{units > 1 ? "s" : ""} · ordered {fmtDateTime(o.createdAt)}
          </span>
          <button disabled={busy} onClick={() => onMove("cancelled")} className="shrink-0 hover:text-destructive">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ProofModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { data, loading } = useApi<{ proof: string | null; paymentRef: string | null }>(
    order ? `/api/preorders/${order.id}/proof` : null,
  );
  return (
    <Modal open={!!order} onClose={onClose} title={`Payment for ${order?.code ?? ""}`}>
      {loading || !data ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : data.proof ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.proof} alt="Payment screenshot" className="w-full rounded-md border border-line" />
      ) : (
        <Empty>No screenshot was attached.</Empty>
      )}
      {data?.paymentRef && (
        <p className="mt-3 text-sm">
          Reference: <span className="font-mono font-medium select-all">{data.paymentRef}</span>
        </p>
      )}
    </Modal>
  );
}

/** Open/close pre-orders and set the cutoff for today and tomorrow. */
function DaySettings({ today }: { today: string }) {
  const { data, reload } = useApi<{ days: DayStatus[] }>(`/api/preorder-days?from=${today}&to=${addDays(today, 1)}`);
  return (
    <Section title="Taking orders" description="Open a day for pre-orders and choose the last time customers can order for it.">
      <div className="grid gap-3 sm:grid-cols-2">
        {(data?.days ?? []).map((d, i) => (
          <DayCard key={`${d.date}-${d.open}-${d.cutoff}`} day={d} label={i === 0 ? "Today" : "Tomorrow"} onSaved={reload} />
        ))}
      </div>
      <Explainer>Customers pay in advance into the current online account (set at the Counter or in Settings).</Explainer>
    </Section>
  );
}

function DayCard({ day, label, onSaved }: { day: DayStatus; label: string; onSaved: () => void }) {
  const [cutoff, setCutoff] = useState(day.cutoff);
  const [busy, setBusy] = useState(false);

  async function save(open: boolean) {
    setBusy(true);
    try {
      await api(`/api/preorder-days/${day.date}`, { method: "PUT", body: { open, cutoff, note: day.note } });
      toast(open ? `${label}: open until ${fmtClock(cutoff)}` : `${label}: pre-orders closed`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">
            {label} <span className="font-normal text-ink-soft">· {fmtDate(day.date)}</span>
          </div>
          <div className="text-xs text-ink-soft">
            {day.accepting
              ? `Taking orders until ${fmtClock(day.cutoff)}`
              : day.open
                ? `Cutoff ${fmtClock(day.cutoff)} has passed`
                : "Pre-orders closed"}
          </div>
        </div>
        <Badge tone={day.accepting ? "good" : "neutral"}>{day.accepting ? "● Open" : "Closed"}</Badge>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Cutoff (on {fmtDate(day.date)})</span>
          <Input type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        </label>
        {day.open ? (
          <>
            {cutoff !== day.cutoff && (
              <Button disabled={busy} onClick={() => save(true)}>
                Save
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => save(false)}>
              Close
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => save(true)}>
            Open
          </Button>
        )}
      </div>
    </div>
  );
}
