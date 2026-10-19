"use client";

import { useState } from "react";
import { ColumnChart } from "@/components/charts";
import { Disclosure, Explainer } from "@/components/kit";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Empty, Field, Input, Modal, Spinner, type Tone } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { rs, toPaisa } from "@/lib/money";
import { fmtDateTime, pkDate } from "@/lib/time";
import { ItemForm } from "./item-form";
import { type Item } from "./types";

export type Tab = "restock" | "waste" | "count" | "prices" | "history" | "edit";

type Move = {
  id: string;
  kind: "restock" | "sale" | "void" | "waste" | "correction" | "settle";
  qty: number;
  cost: number;
  unitCost: number | null;
  oversold: number;
  supplier: string | null;
  note: string | null;
  createdAt: string;
  userName: string | null;
};
type Lot = { id: string; qtyIn: number; qtyLeft: number; unitCost: number; supplier: string | null; createdAt: string };
type PricePoint = { unitPrice: number; first: string; last: string; qty: number };
type HistoryData = { moves: Move[]; lots: Lot[]; batches: Lot[]; prices: PricePoint[] };

const KIND: Record<Move["kind"], { label: string; tone: Tone }> = {
  restock: { label: "Restock", tone: "good" },
  sale: { label: "Sale", tone: "neutral" },
  void: { label: "Void", tone: "warn" },
  waste: { label: "Waste", tone: "bad" },
  correction: { label: "Count", tone: "accent" },
  settle: { label: "Oversell cost", tone: "warn" },
};

export function ItemDialog({
  item,
  initialTab = "restock",
  categories,
  onClose,
  onChanged,
}: {
  item: Item;
  initialTab?: Tab;
  categories: string[];
  onClose: () => void;
  onChanged: (item: Item | null) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { isAdmin } = useMe();
  const history = useApi<HistoryData>(
    tab === "history" || tab === "prices" ? `/api/items/${item.id}/moves?limit=30` : null,
  );

  async function stockAction(body: object) {
    try {
      const res = await api<{ item: Item }>(`/api/items/${item.id}/stock`, { body });
      toast("Stock updated");
      onChanged(res.item);
      return true;
    } catch (e) {
      toast((e as Error).message, "bad");
      return false;
    }
  }

  async function archive(restore: boolean) {
    try {
      await api(`/api/items/${item.id}${restore ? "/restore" : ""}`, { method: restore ? "POST" : "DELETE" });
      toast(restore ? "Restored" : "Archived");
      onChanged({ ...item, active: restore });
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  async function destroy() {
    if (!confirm(`Delete ${item.name} permanently? This only works if it was never stocked or sold.`)) return;
    try {
      await api(`/api/items/${item.id}/permanent`, { method: "DELETE" });
      toast("Deleted");
      onChanged(null);
      onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  const tabs: [Tab, string][] = [
    ["restock", "Add stock"],
    ["waste", "Remove"],
    ["count", "Count"],
    ["prices", "Prices"],
    ["history", "History"],
    ["edit", "Edit"],
  ];

  return (
    <Modal open onClose={onClose} wide title={item.name}>
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Fact label="Sells for" value={rs(item.price)} />
        <Fact
          label="On the shelf"
          value={item.owed > 0 ? `${item.owed} short` : item.stock}
          warn={item.stock <= item.lowStockAt}
        />
        <Fact label="Last bought at" value={item.lastUnitCost === null ? "—" : rs(item.lastUnitCost)} />
      </div>
      {!item.active && (
        <div className="mb-4">
          <Badge>Archived: hidden from the Counter and the rate list</Badge>
        </div>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx(
              "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition",
              tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "restock" && <RestockForm price={item.price} onSubmit={stockAction} />}
      {tab === "waste" && <WasteForm stock={item.stock} onSubmit={stockAction} />}
      {tab === "count" && <CountForm stock={item.stock} onSubmit={stockAction} />}
      {(tab === "history" || tab === "prices") &&
        (!history.data ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : tab === "prices" ? (
          <Prices item={item} batches={history.data.batches ?? []} prices={history.data.prices ?? []} />
        ) : (
          <History moves={history.data.moves} lots={history.data.lots} />
        ))}
      {tab === "edit" && (
        <div className="space-y-5">
          <ItemForm item={item} categories={categories} onSaved={onChanged} />
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {item.active ? (
              <Button variant="secondary" onClick={() => archive(false)}>
                Archive item
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => archive(true)}>
                Restore item
              </Button>
            )}
            {isAdmin && (
              <Button variant="danger" onClick={destroy}>
                Delete permanently
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function RestockForm({ price, onSubmit }: { price: number; onSubmit: (b: object) => Promise<boolean> }) {
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"total" | "unit">("total");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = Math.floor(Number(qty));
  const c = Number(cost);
  const unit = q > 0 && cost !== "" ? (mode === "total" ? toPaisa(c) / q : toPaisa(c)) : null;
  const margin = unit === null ? null : price - Math.round(unit);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(q > 0) || cost === "" || !(c >= 0)) return toast("Enter how many you bought and what you paid", "bad");
        setBusy(true);
        const ok = await onSubmit({
          kind: "restock",
          qty: q,
          ...(mode === "total" ? { totalCost: toPaisa(c) } : { unitCost: toPaisa(c) }),
          supplier: supplier.trim() || null,
          note: note.trim() || null,
        });
        setBusy(false);
        if (ok) {
          setQty("");
          setCost("");
          setNote("");
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="How many did you buy?">
          <Input className="h-11 text-base" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label={mode === "total" ? "Total you paid (Rs)" : "Price for one (Rs)"}>
          <Input className="h-11 text-base" type="number" inputMode="decimal" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
      </div>
      <button type="button" className="text-sm font-medium text-primary" onClick={() => setMode(mode === "total" ? "unit" : "total")}>
        {mode === "total" ? "I know the price for one instead" : "I know the total I paid instead"}
      </button>

      {unit !== null && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <div>
            <div className="text-ink-soft">Each one cost</div>
            <div className="text-lg font-semibold tabular-nums">{rs(Math.round(unit))}</div>
          </div>
          <div>
            <div className="text-ink-soft">You make on each</div>
            <div className={cx("text-lg font-semibold tabular-nums", margin !== null && margin < 0 && "text-destructive")}>
              {rs(margin)}
            </div>
          </div>
        </div>
      )}

      <Disclosure summary="Supplier and note (optional)">
        <div className="space-y-3">
          <Field label="Where from">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Metro" />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Disclosure>

      <Button variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Add to stock"}
      </Button>
    </form>
  );
}

function WasteForm({ stock, onSubmit }: { stock: number; onSubmit: (b: object) => Promise<boolean> }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("Expired");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const q = Math.floor(Number(qty));
        if (!(q > 0)) return toast("Enter a quantity", "bad");
        setBusy(true);
        if (await onSubmit({ kind: "waste", qty: q, note: note.trim() || null })) setQty("");
        setBusy(false);
      }}
    >
      <Explainer>For things that expired, broke or got eaten. They come off the shelf and their cost counts as a loss.</Explainer>
      <div className="grid grid-cols-2 gap-3">
        <Field label="How many?" hint={`${Math.max(stock, 0)} on the shelf`}>
          <Input className="h-11 text-base" type="number" inputMode="numeric" min={1} max={Math.max(stock, 0)} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason">
          <Input list="waste-reasons" value={note} onChange={(e) => setNote(e.target.value)} />
          <datalist id="waste-reasons">
            <option value="Expired" />
            <option value="Damaged" />
            <option value="Eaten by staff" />
          </datalist>
        </Field>
      </div>
      <Button variant="danger" size="lg" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Remove from stock"}
      </Button>
    </form>
  );
}

function CountForm({ stock, onSubmit }: { stock: number; onSubmit: (b: object) => Promise<boolean> }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const n = counted === "" ? null : Math.floor(Number(counted));
  const diff = n === null || !(n >= 0) ? null : n - stock;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (n === null || !(n >= 0)) return toast("Enter the count", "bad");
        setBusy(true);
        if (await onSubmit({ kind: "count", counted: n, note: note.trim() || null })) setCounted("");
        setBusy(false);
      }}
    >
      <Explainer>
        The app thinks there are <b className="text-ink">{stock}</b>. Count what&apos;s really on the shelf and enter it here.
        The difference is saved as a correction.
      </Explainer>
      <Field
        label="How many are on the shelf?"
        hint={diff === null ? undefined : diff === 0 ? "Matches the system" : `${diff > 0 ? "+" : ""}${diff} will be logged`}
      >
        <Input className="h-11 text-base" type="number" inputMode="numeric" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Save count"}
      </Button>
    </form>
  );
}

function History({ moves, lots }: { moves: Move[]; lots: Lot[] }) {
  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">On the shelf (sold oldest first)</h4>
        {lots.length === 0 ? (
          <Empty>No stock batches left.</Empty>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {lots.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">
                    {l.qtyLeft} of {l.qtyIn}
                  </span>{" "}
                  <span className="text-ink-soft">at {rs(l.unitCost)}</span>
                  {i === 0 && (
                    <span className="ml-2">
                      <Badge tone="accent">Selling now</Badge>
                    </span>
                  )}
                </div>
                <div className="text-right text-xs text-ink-faint">
                  {l.supplier && <div>{l.supplier}</div>}
                  {fmtDateTime(l.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Recent changes</h4>
        {moves.length === 0 ? (
          <Empty>No stock changes yet.</Empty>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {moves.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND[m.kind].tone}>{KIND[m.kind].label}</Badge>
                    {m.qty !== 0 && (
                      <span className={cx("font-medium tabular-nums", m.qty > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-ink")}>
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </span>
                    )}
                    {m.kind === "restock" && m.unitCost !== null && <span className="text-ink-soft">at {rs(m.unitCost)}</span>}
                    {m.cost !== 0 && m.kind !== "restock" && <span className="text-ink-soft">cost {rs(m.cost)}</span>}
                    {m.oversold > 0 && <Badge tone="bad">{m.oversold} oversold</Badge>}
                  </div>
                  {(m.note || m.supplier) && (
                    <div className="mt-0.5 truncate text-xs text-ink-soft">{[m.supplier, m.note].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-ink-faint">
                  <div>{m.userName ?? "—"}</div>
                  {fmtDateTime(m.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Every batch bought and every price it sold at, so price changes are easy to follow. */
function Prices({ item, batches, prices }: { item: Item; batches: Lot[]; prices: PricePoint[] }) {
  // The oldest batch with stock left is the one sales draw from next.
  const sellingNow = [...batches].reverse().find((b) => b.qtyLeft > 0);
  const chart = [...batches].reverse().map((b) => ({
    label: new Date(b.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "Asia/Karachi" }),
    hint: `Bought ${b.qtyIn} on ${pkDate(b.createdAt)}${b.supplier ? ` · ${b.supplier}` : ""}`,
    values: { cost: b.unitCost },
  }));

  return (
    <div className="space-y-6">
      <Explainer>
        Every batch keeps the price you paid for it. Sales use the oldest batch first, and every sale keeps the price it
        was sold at, so changing a price never changes past profit.
      </Explainer>

      {batches.length === 0 ? (
        <Empty>No stock bought yet. Use Add stock to record a batch and what you paid.</Empty>
      ) : (
        <>
          <section className="space-y-5">
            <h4 className="text-sm font-semibold">What you paid for one, batch by batch</h4>
            <ColumnChart
              data={chart}
              series={[{ key: "cost", label: "Bought at" }]}
              format={(v) => rs(v)}
              toAxis={(v) => v / 100}
              height={150}
            />
          </section>

          {sellingNow && (
            <div className="rounded-xl bg-primary-soft/60 p-4 text-sm">
              <div className="text-ink-soft">Selling now from the batch bought {fmtDateTime(sellingNow.createdAt)}</div>
              <div className="mt-0.5 text-base font-semibold text-ink">
                {rs(sellingNow.unitCost)} each · {sellingNow.qtyLeft} of {sellingNow.qtyIn} left
              </div>
            </div>
          )}

          <Disclosure summary={`All ${batches.length} batch${batches.length > 1 ? "es" : ""}`}>
            <ul className="divide-y divide-line">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">{rs(b.unitCost)} each</span>
                      <span className="text-ink-soft">
                        bought {b.qtyIn}, {b.qtyLeft} left
                      </span>
                      {b.id === sellingNow?.id && <Badge tone="good">Selling now</Badge>}
                      {b.qtyLeft === 0 && <Badge>Used up</Badge>}
                    </div>
                    {b.supplier && <div className="truncate text-xs text-ink-soft">{b.supplier}</div>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-faint">{fmtDateTime(b.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Disclosure>
        </>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Prices it sold at</h4>
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="font-semibold tabular-nums">{rs(item.price)}</span>
            <Badge tone="good">Price now</Badge>
          </li>
          {prices.map((p) => (
            <li key={p.unitPrice} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium tabular-nums">{rs(p.unitPrice)}</span>{" "}
                <span className="text-ink-soft">· {p.qty} sold</span>
              </span>
              <span className="text-right text-xs text-ink-faint">
                {pkDate(p.first)} to {pkDate(p.last)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Fact({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={cx("mt-0.5 text-lg font-semibold tabular-nums", warn && "text-destructive")}>{value}</div>
    </div>
  );
}
