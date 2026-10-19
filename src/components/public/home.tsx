"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Badge, Card, cx, Empty, Input, Spinner } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate } from "@/lib/time";
import { DistanceCheck } from "./distance";
import { ItemThumb } from "./item-thumb";
import type { PublicItem, ShopInfo } from "./types";

const AVAIL = {
  in: { label: "In stock", tone: "good" },
  few: { label: "Few left", tone: "warn" },
  out: { label: "Sold out", tone: "bad" },
} as const;

export function HomeClient() {
  const { data: menu, loading, stale } = useApi<{ items: PublicItem[] }>("/api/public/items");
  const { data: info } = useApi<ShopInfo>("/api/public/info");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const items = useMemo(() => menu?.items ?? [], [menu]);
  const categories = useMemo(() => ["All", ...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter(
    (i) =>
      (category === "All" || i.category === category) && i.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const openDay = info?.days.find((d) => d.accepting);
  const shop = info?.shop;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-[1fr_300px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Menu</h2>
          <div className="relative sm:w-64">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
            <Input placeholder="Search snacks and drinks" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        </div>

        {categories.length > 2 && (
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition",
                  c === category ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-soft hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {stale && <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">Offline: this menu may be out of date.</p>}

        {loading && !menu ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <Empty>{items.length ? "Nothing matches your search." : "The menu is empty right now."}</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((i) => (
              <li key={i.id}>
                <Card className={cx("flex h-full flex-col overflow-hidden", i.availability === "out" && "opacity-60")}>
                  <ItemThumb name={i.name} image={i.image} className="aspect-[4/3] w-full rounded-none text-3xl" />
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="text-sm leading-snug font-medium">{i.name}</div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="font-semibold tabular-nums">{rs(i.price)}</span>
                      <Badge tone={AVAIL[i.availability].tone}>{AVAIL[i.availability].label}</Badge>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-4">
          <div className="text-sm font-semibold">Pre-order</div>
          <p className="mt-1 text-sm text-ink-soft">
            {openDay
              ? `Taking orders for ${fmtDate(openDay.date)}${openDay.date === info?.days[0]?.date ? ` until ${fmtClock(openDay.cutoff)}` : ""}. Pay in advance on NayaPay and skip the queue.`
              : "Pre-orders are closed right now. Check back later."}
          </p>
          <Link
            href="/preorder"
            className="mt-3 inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90"
          >
            {openDay ? "Order ahead" : "My orders"}
          </Link>
        </Card>
        <DistanceCheck shop={shop} />
        {(shop?.hours || shop?.whatsapp) && (
          <Card className="space-y-3 p-4 text-sm">
            {shop.hours && (
              <div>
                <div className="font-semibold">Opening hours</div>
                <p className="mt-0.5 whitespace-pre-line text-ink-soft">{shop.hours}</p>
              </div>
            )}
            {shop.whatsapp && (
              <div>
                <div className="font-semibold">Contact</div>
                <a
                  className="mt-0.5 inline-block text-accent hover:underline"
                  href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp {shop.whatsapp}
                </a>
              </div>
            )}
          </Card>
        )}
      </aside>
    </div>
  );
}
