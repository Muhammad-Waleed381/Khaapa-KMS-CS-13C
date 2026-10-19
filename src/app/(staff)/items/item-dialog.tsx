"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Empty, Field, Input, Modal, Spinner, type Tone } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { rs, toPaisa } from "@/lib/money";
import { fmtDateTime } from "@/lib/time";
import { ItemForm } from "./item-form";
import { type Item } from "./types";

type Tab = "restock" | "waste" | "count" | "history" | "edit";

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
  categories,
  onClose,
  onChanged,
}: {
  item: Item;
  categories: string[];
  onClose: () => void;
  onChanged: (item: Item | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("restock");
  const { isAdmin } = useMe();
  const history = useApi<{ moves: Move[]; lots: Lot[] }>(tab === "history" ? `/api/items/${item.id}/moves?limit=30` : null);

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
    ["restock", "Restock"],
    ["waste", "Waste"],
    ["count", "Count"],
    ["history", "History"],
    ["edit", "Edit"],
  ];

  return (
    <Modal open onClose={onClose} wide title={item.name}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span>
          Sells for <b className="text-ink">{rs(item.price)}</b>
        </span>
        <span>
          In stock <b className={cx(item.stock <= item.lowStockAt ? "text-destructive" : "text-ink")}>{item.stock}</b>
        </span>
        {item.owed > 0 && <Badge tone="bad">Oversold {item.owed}</Badge>}
        {!item.active && <Badge>Archived</Badge>}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx(
              "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "restock" && <RestockForm onSubmit={stockAction} />}
      {tab === "waste" && <WasteForm stock={item.stock} onSubmit={stockAction} />}
      {tab === "count" && <CountForm stock={item.stock} onSubmit={stockAction} />}
      {tab === "history" &&
        (!history.data ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
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

function RestockForm({ onSubmit }: { onSubmit: (b: object) => Promise<boolean> }) {
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"total" | "unit">("total");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = Math.floor(Number(qty));
  const c = Number(cost);
  const unit = q > 0 && cost !== "" ? (mode === "total" ? toPaisa(c) / q : toPaisa(c)) : null;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(q > 0) || cost === "" || !(c >= 0)) return toast("Enter quantity and cost", "bad");
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
        <Field label="Quantity">
          <Input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label={mode === "total" ? "Total paid (Rs)" : "Cost per unit (Rs)"}>
          <Input type="number" inputMode="decimal" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <button type="button" className="font-medium text-primary" onClick={() => setMode(mode === "total" ? "unit" : "total")}>
          {mode === "total" ? "Enter cost per unit instead" : "Enter total paid instead"}
        </button>
        {unit !== null && <span className="text-ink-soft">= {rs(Math.round(unit))} per unit</span>}
      </div>
      <Field label="Supplier (optional)">
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Metro" />
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button variant="primary" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Add stock"}
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
      <p className="text-sm text-ink-soft">Remove expired, damaged or wasted units. They are valued at FIFO cost.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity removed" hint={`${Math.max(stock, 0)} on the shelf`}>
          <Input type="number" inputMode="numeric" min={1} max={Math.max(stock, 0)} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
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
      <Button variant="danger" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Write off"}
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
      <p className="text-sm text-ink-soft">
        Currently <b className="text-ink">{stock}</b> in the system. Enter the actual count on the shelf; the difference
        is logged as a correction.
      </p>
      <Field
        label="Actual count on the shelf"
        hint={diff === null ? undefined : diff === 0 ? "Matches the system" : `${diff > 0 ? "+" : ""}${diff} will be logged`}
      >
        <Input type="number" inputMode="numeric" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button variant="primary" className="w-full" disabled={busy}>
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
