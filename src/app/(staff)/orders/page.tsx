"use client";

import { useEffect, useState } from "react";
import { STATUS_LABEL, STATUS_TONE, type DayStatus, type PreorderLine, type PreorderStatus } from "@/components/public/types";
import { toast } from "@/components/toast";
import { Badge, Button, Card, cx, Empty, Input, Modal, PageHeader, Spinner, StaleNote } from "@/components/ui";
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
  createdAt: string;
};

type Action = "paid" | "ready" | "collected" | "cancelled";

const FILTERS: ("all" | PreorderStatus)[] = ["all", "awaiting_payment", "paid", "ready", "collected", "cancelled"];

export default function OrdersPage() {
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
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
  const shown = orders.filter((o) => filter === "all" || o.status === filter);
  const count = (s: PreorderStatus) => orders.filter((o) => o.status === s).length;

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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Pre-orders"
        sub="Verify advance payments, prepare orders and hand them over."
        actions={
          <Button onClick={() => reload()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <StaleNote stale={stale} />

      {today && <DaySettings today={today} />}

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        {today && (
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {[addDays(today, -1), today, addDays(today, 1)].map((d, i) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cx(
                  "rounded-md px-3 py-1 text-sm font-medium",
                  date === d ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink",
                )}
              >
                {["Yesterday", "Today", "Tomorrow"][i]}
              </button>
            ))}
          </div>
        )}
        <Input type="date" value={date ?? ""} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
              f === filter ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface text-ink-soft hover:text-ink",
            )}
          >
            {f === "all" ? `All ${orders.length}` : `${STATUS_LABEL[f]} ${count(f)}`}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : shown.length === 0 ? (
        <Empty>No pre-orders {filter === "all" ? "" : `marked "${STATUS_LABEL[filter]}" `}for {date && fmtDate(date)}.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((o) => (
            <Card key={o.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold tracking-widest">{o.code}</span>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium">{o.customerName}</div>
                  <a href={`tel:${o.phone}`} className="text-xs text-ink-soft hover:text-primary">
                    {o.phone}
                  </a>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold tabular-nums">{rs(o.total)}</div>
                  <div className="text-xs text-ink-faint">{fmtDateTime(o.createdAt)}</div>
                </div>
              </div>

              <ul className="mt-3 space-y-0.5 text-sm">
                {o.lines.map((l) => (
                  <li key={l.itemId} className="flex justify-between gap-2">
                    <span>
                      <b className="tabular-nums">{l.qty}×</b> {l.name}
                    </span>
                    <span className="text-ink-soft tabular-nums">{rs(l.qty * l.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              {o.note && <p className="mt-2 rounded-md bg-muted px-2 py-1 text-xs text-ink-soft">“{o.note}”</p>}

              <div className="mt-3 text-xs text-ink-soft">
                {o.paymentRef ? (
                  <>
                    NayaPay ref <span className="font-mono font-medium text-ink select-all">{o.paymentRef}</span>
                    {o.hasProof && (
                      <button onClick={() => setProofOf(o)} className="ml-2 text-primary hover:underline">
                        View screenshot
                      </button>
                    )}
                  </>
                ) : o.status === "awaiting_payment" ? (
                  "No payment proof yet"
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                {o.status === "awaiting_payment" && (
                  <Button size="sm" variant="primary" disabled={busy === o.id} onClick={() => move(o, "paid")}>
                    Payment received
                  </Button>
                )}
                {o.status === "paid" && (
                  <Button size="sm" disabled={busy === o.id} onClick={() => move(o, "ready")}>
                    Mark ready
                  </Button>
                )}
                {(o.status === "paid" || o.status === "ready") && (
                  <Button size="sm" variant="primary" disabled={busy === o.id} onClick={() => move(o, "collected")}>
                    Handed over
                  </Button>
                )}
                {o.status !== "collected" && o.status !== "cancelled" && (
                  <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => move(o, "cancelled")}>
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProofModal order={proofOf} onClose={() => setProofOf(null)} />
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
    <div className="grid gap-3 sm:grid-cols-2">
      {(data?.days ?? []).map((d, i) => (
        <DayCard key={`${d.date}-${d.open}-${d.cutoff}`} day={d} label={i === 0 ? "Today" : "Tomorrow"} onSaved={reload} />
      ))}
    </div>
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
    <Card className="p-4">
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
        <Badge tone={day.accepting ? "good" : "neutral"}>{day.accepting ? "Open" : "Closed"}</Badge>
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
    </Card>
  );
}
