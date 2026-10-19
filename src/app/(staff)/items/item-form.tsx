"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/client/api";
import { toPaisa, toRupees } from "@/lib/money";
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

  const preview = image === undefined ? (item?.hasImage ? imgSrc(item) : null) : image;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    if (!name.trim() || !Number.isFinite(p) || p < 0) return toast("Enter a name and a price", "bad");
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category: category.trim() || "Snacks",
        price: toPaisa(p),
        lowStockAt: Math.max(0, Math.floor(Number(lowStockAt) || 0)),
        preorder,
        ...(image !== undefined ? { image } : {}),
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
      <Button variant="primary" className="w-full" disabled={saving}>
        {saving ? "Saving…" : item ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}
