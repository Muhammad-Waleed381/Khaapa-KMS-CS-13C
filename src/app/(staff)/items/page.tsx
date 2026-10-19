"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Badge, Button, cx, Empty, Input, Modal, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { ItemDialog } from "./item-dialog";
import { ItemForm } from "./item-form";
import { imgSrc, isLow, type Item } from "./types";

export default function ItemsPage() {
  const { data, loading, stale, setData } = useApi<{ items: Item[] }>("/api/items?all=1");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const low = items.filter(isLow);
  const archivedCount = items.filter((i) => !i.active).length;
  const open = items.find((i) => i.id === openId) ?? null;

  const visible = items.filter(
    (i) =>
      i.active !== showArchived &&
      (!category || i.category === category) &&
      i.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const groups = [...new Set(visible.map((i) => i.category))].map((c) => ({
    category: c,
    items: visible.filter((i) => i.category === c),
  }));

  // Replace one item in the list (or drop it when deleted).
  function updated(id: string, item: Item | null) {
    setData((d) => d && { items: item ? d.items.map((i) => (i.id === id ? item : i)) : d.items.filter((i) => i.id !== id) });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Items"
        sub="Menu, prices and stock. Tap an item to restock, write off or count it."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add item
          </Button>
        }
      />
      <StaleNote stale={stale} />

      {low.length > 0 && !showArchived && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Icon name="alert" /> Low stock: {low.length} item{low.length > 1 ? "s" : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {low.map((i) => (
              <button
                key={i.id}
                onClick={() => setOpenId(i.id)}
                className="rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium hover:bg-white dark:bg-black/20 dark:hover:bg-black/40"
              >
                {i.name} · {i.stock}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-faint">
            <Icon name="search" />
          </span>
          <Input className="pl-9" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 accent-accent"
          />
          Archived ({archivedCount})
        </label>
      </div>

      {categories.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              onClick={() => setCategory(c)}
              className={cx(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition",
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-line bg-surface text-ink-soft hover:text-ink",
              )}
            >
              {c ?? "All"}
            </button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <Empty>
          {items.length === 0 ? "No items yet. Add your first item to start selling." : "Nothing matches."}
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{g.category}</h2>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {g.items.map((i) => (
                  <ItemRow key={i.id} item={i} onClick={() => setOpenId(i.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add item">
        <ItemForm
          categories={categories}
          onSaved={(item) => {
            setData((d) => ({ items: [...(d?.items ?? []), item] }));
            setAdding(false);
            setOpenId(item.id);
          }}
        />
      </Modal>

      {open && (
        <ItemDialog
          key={open.id}
          item={open}
          categories={categories}
          onClose={() => setOpenId(null)}
          onChanged={(item) => updated(open.id, item)}
        />
      )}
    </div>
  );
}

function ItemRow({ item: i, onClick }: { item: Item; onClick: () => void }) {
  const profit = i.lastUnitCost === null ? null : i.price - i.lastUnitCost;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-sm font-semibold text-ink-faint">
        {i.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc(i)} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          i.name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{i.name}</span>
          {!i.preorder && i.active && <Badge>No pre-order</Badge>}
        </div>
        <div className="truncate text-xs text-ink-soft">
          {i.lastUnitCost === null ? (
            "No buy price yet"
          ) : (
            <>
              Buy {rs(i.lastUnitCost)} ·{" "}
              <span className={cx(profit !== null && profit < 0 && "text-destructive")}>profit {rs(profit)}/unit</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{rs(i.price)}</div>
        <div className="mt-0.5 flex justify-end gap-1">
          {i.owed > 0 ? (
            <Badge tone="bad">Oversold {i.owed}</Badge>
          ) : (
            <Badge tone={i.stock <= 0 ? "bad" : i.stock <= i.lowStockAt ? "warn" : "neutral"}>
              {i.stock <= 0 ? "Out of stock" : `${i.stock} left`}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
