"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs, toPaisa, toRupees } from "@/lib/money";
import { compressImage, imgSrc, type Item } from "./types";

/** Create (no `item`) or edit an item's details. */
export function ItemForm({
  item,
  categories,
  onSaved,
}: {
  item?: Item;
  categories: string[];
  onSaved: (item: Item) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? "Snacks");
  const [price, setPrice] = useState(item ? String(toRupees(item.price)) : "");
  const [lowStockAt, setLowStockAt] = useState(String(item?.lowStockAt ?? 5));
  const [preorder, setPreorder] = useState(item?.preorder ?? true);
  // undefined = unchanged, null = removed, string = new photo
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  // Opening stock (new items only): the first batch and what was paid for it.
  const [qty, setQty] = useState("");
  const [costMode, setCostMode] = useState<"total" | "unit">("total");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const q = Math.floor(Number(qty)) || 0;
  const c = Number(cost);
  const unit = q > 0 && cost !== "" && c >= 0 ? (costMode === "total" ? toPaisa(c) / q : toPaisa(c)) : null;

  const preview = image === undefined ? (item?.hasImage ? imgSrc(item) : null) : image;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    if (!name.trim() || !Number.isFinite(p) || p < 0) return toast("Enter a name and a price", "bad");
    if (!item && q > 0 && unit === null) return toast("Enter what you paid for the opening stock", "bad");
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category: category.trim() || "Snacks",
        price: toPaisa(p),
        lowStockAt: Math.max(0, Math.floor(Number(lowStockAt) || 0)),
        preorder,
        ...(image !== undefined ? { image } : {}),
        ...(!item && q > 0
          ? {
              openingStock: {
                qty: q,
                ...(costMode === "total" ? { totalCost: toPaisa(c) } : { unitCost: toPaisa(c) }),
                supplier: supplier.trim() || null,
              },
            }
          : {}),
      };
      const res = item
        ? await api<{ item: Item }>(`/api/items/${item.id}`, { method: "PATCH", body })
        : await api<{ item: Item }>("/api/items", { body });
      toast(item ? "Saved" : "Item added");
      onSaved(res.item);
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-muted text-xl font-semibold text-ink-faint">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            (name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-8 cursor-pointer items-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium shadow-sm hover:bg-muted">
            {preview ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setImage(await compressImage(f));
                } catch {
                  toast("Couldn't read that image", "bad");
                }
              }}
            />
          </label>
          {preview && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setImage(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cocomo" autoFocus={!item} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Input list="item-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="item-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Sells for (Rs)">
          <Input type="number" inputMode="decimal" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="Low-stock alert at" hint="Warn when this many or fewer are left">
        <Input type="number" inputMode="numeric" min={0} value={lowStockAt} onChange={(e) => setLowStockAt(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={preorder} onChange={(e) => setPreorder(e.target.checked)} className="size-4 accent-accent" />
        Available for pre-order
      </label>
      {!item && (
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-medium text-ink-soft">Opening stock (optional)</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </Field>
            <Field label={costMode === "total" ? "Total paid (Rs)" : "Buy price per unit (Rs)"}>
              <Input type="number" inputMode="decimal" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <button type="button" className="font-medium text-primary" onClick={() => setCostMode(costMode === "total" ? "unit" : "total")}>
              {costMode === "total" ? "Enter price per unit instead" : "Enter total paid instead"}
            </button>
            {unit !== null && (
              <span className="text-ink-soft">
                = {rs(Math.round(unit))} per unit
                {Number(price) > 0 && ` · profit ${rs(toPaisa(Number(price)) - Math.round(unit))}/unit`}
              </span>
            )}
          </div>
          <Field label="Supplier (optional)">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Metro" />
          </Field>
          <p className="text-xs text-ink-faint">Later purchases go in the item&apos;s Restock tab, each with its own price.</p>
        </fieldset>
      )}
      <Button variant="primary" className="w-full" disabled={saving}>
        {saving ? "Saving…" : item ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}
