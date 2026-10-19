"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { EmptyState, KpiRow, KpiTile, Section } from "@/components/kit";
import { Button, cx, Input, Modal, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { ItemDialog, type Tab } from "./item-dialog";
import { ItemForm } from "./item-form";
import { imgSrc, STATUS_LABEL, stockStatus, type Item, type StockStatus } from "./types";

const RESTOCK_PREVIEW = 6;

export default function ItemsPage() {
  const { data, loading, stale, setData } = useApi<{ items: Item[] }>("/api/items?all=1");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [allLow, setAllLow] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<{ id: string; tab: Tab } | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const active = items.filter((i) => i.active);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  // Out of stock first, then the ones with the fewest left.
  const needs = active
    .filter((i) => stockStatus(i) !== "ok")
    .sort((a, b) => a.stock - a.lowStockAt - (b.stock - b.lowStockAt));
  const lowCount = active.filter((i) => stockStatus(i) === "low").length;
  const outCount = active.filter((i) => ["out", "oversold"].includes(stockStatus(i))).length;
  const shelfValue = active.reduce((s, i) => s + (i.stockValue ?? 0), 0);
  const archivedCount = items.length - active.length;
  const openItem = items.find((i) => i.id === open?.id) ?? null;

  const q = query.trim().toLowerCase();
  const visible = items.filter(
    (i) => i.active !== showArchived && (!category || i.category === category) && i.name.toLowerCase().includes(q),
  );

  function updated(id: string, item: Item | null) {
    setData((d) => d && { items: item ? d.items.map((i) => (i.id === id ? item : i)) : d.items.filter((i) => i.id !== id) });
  }

  if (loading && !data)
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <PageHeader
          title="Items"
          sub="Your menu and what's on the shelf. Tap an item to add stock, fix a count or change its price."
          actions={
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon name="plus" /> Add item
            </Button>
          }
        />
        <StaleNote stale={stale} />
        {items.length > 0 && (
          <KpiRow>
            <KpiTile label="On sale" value={active.length} hint={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`} />
            <KpiTile label="Running low" value={lowCount} hint="Restock soon" />
            <KpiTile label="Out of stock" value={outCount} hint="Can't be sold from the shelf" />
            <KpiTile label="Stock value" value={rs(Math.round(shelfValue / 100) * 100)} hint="What the shelf cost us" />
          </KpiRow>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add your first item with its price and how many you bought. It shows up on the Counter and the public rate list."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon name="plus" /> Add your first item
            </Button>
          }
        />
      ) : (
        <>
          {needs.length > 0 && !showArchived && (
            <Section
              title="Needs restocking"
              description="These are low or gone. Tap Add stock after you buy more."
              action={
                needs.length > RESTOCK_PREVIEW && (
                  <Button size="sm" variant="ghost" onClick={() => setAllLow(!allLow)}>
                    {allLow ? "Show fewer" : `Show all ${needs.length}`}
                  </Button>
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(allLow ? needs : needs.slice(0, RESTOCK_PREVIEW)).map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-col sm:items-stretch sm:p-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Thumb item={i} size="size-12" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{i.name}</div>
                        <StatusLine item={i} />
                      </div>
                    </div>
                    <Button variant="primary" className="shrink-0 sm:w-full" onClick={() => setOpen({ id: i.id, tab: "restock" })}>
                      <Icon name="plus" /> <span className="hidden sm:inline">Add stock</span>
                      <span className="sm:hidden">Stock</span>
                    </Button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={showArchived ? "Archived items" : "All items"} description={showArchived ? "Hidden from the Counter and the rate list. Open one to restore it." : undefined}>
            <div className="space-y-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-faint">
                  <Icon name="search" />
                </span>
                <Input className="h-11 pl-9 text-base" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[null, ...categories].map((c) => (
                    <button
                      key={c ?? "all"}
                      onClick={() => setCategory(c)}
                      className={cx(
                        "min-h-9 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition",
                        category === c ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface text-ink-soft hover:text-ink",
                      )}
                    >
                      {c ?? "All"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {visible.length === 0 ? (
              <EmptyState title="Nothing matches" description="Try another name or category." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((i) => (
                  <ItemCard key={i.id} item={i} onClick={() => setOpen({ id: i.id, tab: "restock" })} />
                ))}
              </div>
            )}

            {archivedCount > 0 && (
              <button className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? "Back to items on sale" : `Show ${archivedCount} archived item${archivedCount > 1 ? "s" : ""}`}
              </button>
            )}
          </Section>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add item">
        <ItemForm
          categories={categories}
          onSaved={(item) => {
            setData((d) => ({ items: [...(d?.items ?? []), item] }));
            setAdding(false);
            setOpen({ id: item.id, tab: "restock" });
          }}
        />
      </Modal>

      {openItem && (
        <ItemDialog
          key={openItem.id}
          item={openItem}
          initialTab={open!.tab}
          categories={categories}
          onClose={() => setOpen(null)}
          onChanged={(item) => updated(openItem.id, item)}
        />
      )}
    </div>
  );
}

function Thumb({ item: i, size }: { item: Item; size: string }) {
  return (
    <div className={cx("grid shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-lg font-semibold text-ink-faint", size)}>
      {i.hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc(i)} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        i.name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

const STATUS_STYLE: Record<StockStatus, { dot: string; bar: string }> = {
  ok: { dot: "bg-primary", bar: "bg-[var(--series-1)]" },
  low: { dot: "bg-warn", bar: "bg-warn" },
  out: { dot: "bg-destructive", bar: "bg-destructive" },
  oversold: { dot: "bg-destructive", bar: "bg-destructive" },
};

/** "Running low · 3 left" with a coloured dot; the word carries the meaning. */
function StatusLine({ item: i }: { item: Item }) {
  const s = stockStatus(i);
  const detail = s === "oversold" ? `${i.owed} sold without stock` : s === "out" ? "none left" : `${i.stock} left`;
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm text-ink-soft">
      <span className={cx("size-2 shrink-0 rounded-full", STATUS_STYLE[s].dot)} />
      <span className={cx(s !== "ok" && "font-medium text-ink")}>{STATUS_LABEL[s]}</span>
      <span className="truncate text-ink-faint">· {detail}</span>
    </div>
  );
}

function ItemCard({ item: i, onClick }: { item: Item; onClick: () => void }) {
  const s = stockStatus(i);
  // The bar is full at three times the low-stock level, so "low" sits at a third.
  const full = Math.max(i.lowStockAt * 3, 1);
  const pct = Math.max(0, Math.min(100, (i.stock / full) * 100));
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-primary/40 hover:shadow-sm sm:gap-3 sm:p-4"
    >
      <div className="flex items-center gap-3">
        <Thumb item={i} size="size-12 sm:size-14" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink">{i.name}</div>
          <div className="text-sm text-ink-soft">
            Sells for <span className="font-semibold text-ink tabular-nums">{rs(i.price)}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="h-1.5 rounded-full bg-muted">
          <div className={cx("h-1.5 rounded-full", STATUS_STYLE[s].bar)} style={{ width: `${pct}%` }} />
        </div>
        <StatusLine item={i} />
      </div>
    </button>
  );
}
