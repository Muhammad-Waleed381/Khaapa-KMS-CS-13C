"use client";

import { Marquee } from "@/components/ui/marquee";
import { useApi } from "@/lib/client/api";
import { FindUs } from "./find-us";
import { PublicFooter } from "./footer";
import { Hero } from "./hero";
import { Letter } from "./letter";
import { OrderAhead } from "./order-ahead";
import { RateSheet } from "./rate-sheet";
import type { PublicItem, ShopInfo } from "./types";

/** The public site: the shop's rate list and the pieces of paper around it. */
export function PublicHome() {
  const { data: menu, loading, stale } = useApi<{ items: PublicItem[] }>("/api/public/items");
  const { data: info } = useApi<ShopInfo>("/api/public/info");
  const items = menu?.items ?? [];
  const inStock = items.filter((i) => i.availability !== "out");

  return (
    <main>
      <Hero info={info ?? undefined} />
      <RateSheet items={items} loading={loading} stale={stale} />

      {inStock.length > 0 && (
        // What's on the shelf right now, running past like a shop ticker.
        <div className="bg-(--pub-ground) py-8 text-(--pub-ground-ink) md:py-10" aria-label="In stock now">
          <Marquee pauseOnHover repeat={3} className="p-0 [--duration:50s] [--gap:3rem] motion-reduce:[&_*]:[animation-play-state:paused]">
            {inStock.map((i) => (
              <span key={i.id} className="font-display text-5xl whitespace-nowrap md:text-7xl">
                {i.name}
                <span className="ml-12 text-(--pub-green-ink)/40">·</span>
              </span>
            ))}
          </Marquee>
        </div>
      )}

      <OrderAhead info={info ?? undefined} items={items} />
      <FindUs shop={info?.shop} />
      <Letter shop={info?.shop} />
      <PublicFooter shop={info?.shop} />
    </main>
  );
}
