"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate } from "@/lib/time";
import { preorderLine } from "./hero";
import type { PublicItem, ShopInfo } from "./types";

/** A small, real piece of the pre-order screen, shown where a photograph would go. */
function Fragment({ children }: { children: ReactNode }) {
  return (
    <div data-ui className="flex aspect-square w-full flex-col justify-center gap-3 md:aspect-[5/4] bg-(--pub-paper) p-5 text-(--pub-paper-ink)">
      {children}
    </div>
  );
}

/** How a pre-order goes, in four steps, each with a real piece of the screen. */
export function OrderAhead({ info, items }: { info?: ShopInfo; items: PublicItem[] }) {
  const [progress, setProgress] = useState(0);
  const days = info?.days ?? [];
  const account = info?.account;
  const sample = items.filter((i) => i.preorder && i.availability !== "out").slice(0, 3);
  const sampleTotal = sample.reduce((s, i) => s + i.price, 0);

  const moments: { title: string; body: string; gap: string; ui: ReactNode }[] = [
    {
      title: "Pick a day",
      body: "Today or tomorrow, before the cutoff.",
      gap: "h-16 md:h-20",
      ui: (
        <Fragment>
          {(days.length ? days : [null, null]).map((d, i) => (
            <div key={i} className={cn("p-3", i === 0 ? "bg-(--pub-green) text-(--pub-green-ink)" : "bg-(--pub-bone)")}>
              <div className="font-semibold">{i === 0 ? "Today" : "Tomorrow"}</div>
              <div className="text-sm">
                {d ? (d.accepting ? (i === 0 ? `Order before ${fmtClock(d.cutoff)}` : `Open · ${fmtDate(d.date)}`) : "Closed") : "Open"}
              </div>
            </div>
          ))}
        </Fragment>
      ),
    },
    {
      title: "Fill your cart",
      body: "Same prices as the counter.",
      gap: "h-6 md:h-8",
      ui: (
        <Fragment>
          {(sample.length ? sample : [{ id: "a", name: "Your snack", price: 0 }]).map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 text-[0.9375rem]">
              <span className="truncate font-semibold">{i.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="grid size-7 place-items-center bg-(--pub-bone)">−</span>1
                <span className="grid size-7 place-items-center bg-(--pub-bone)">+</span>
              </span>
            </div>
          ))}
          {sampleTotal > 0 && (
            <div className="mt-2 flex justify-between bg-(--pub-bone) p-2 font-semibold tabular-nums">
              <span>Total</span>
              <span>{rs(sampleTotal)}</span>
            </div>
          )}
        </Fragment>
      ),
    },
    {
      title: "Pay online",
      body: "Send the total, then paste the transaction ID.",
      gap: "h-20 md:h-24",
      ui: (
        <Fragment>
          <div className="text-sm text-(--pub-paper-soft)">Pay to</div>
          <div className="font-semibold">{account?.accountTitle || "Khaapa SEECS"}</div>
          <div className="text-sm text-(--pub-paper-soft)">{account?.provider ?? "Account"}</div>
          <div className="font-semibold">{account?.accountNumber || "Shown after you order"}</div>
          {sampleTotal > 0 && (
            <>
              <div className="text-sm text-(--pub-paper-soft)">Amount</div>
              <div className="font-display text-3xl tabular-nums">{rs(sampleTotal)}</div>
            </>
          )}
        </Fragment>
      ),
    },
    {
      title: "Collect",
      body: "Show your code at the counter.",
      gap: "h-10 md:h-12",
      ui: (
        <Fragment>
          <div className="text-center text-sm text-(--pub-paper-soft)">Order code</div>
          <div className="text-center font-display text-6xl tracking-[0.08em]">K7M2QP</div>
          <div className="bg-(--pub-green) p-3 text-center font-semibold text-(--pub-green-ink)">Ready for pickup</div>
        </Fragment>
      ),
    },
  ];

  return (
    <section id="order-ahead" className="scroll-mt-4 overflow-hidden bg-(--pub-bone) py-20 text-(--pub-paper-ink) md:py-28">
      <BlurFade inView className="px-5 md:px-8">
        <h2 className="font-display text-5xl md:text-6xl">Order ahead</h2>
      </BlurFade>
      {/* Phones swipe through the steps; the bar shows how far along they are. */}
      <div className="mx-5 mt-6 h-1.5 bg-(--pub-paper-ink)/12 md:hidden" aria-hidden>
        <div
          className="h-full bg-(--pub-paper-ink) transition-[width] duration-150"
          style={{ width: `${Math.max(25, progress * 100)}%` }}
        />
      </div>

      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          setProgress(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth));
        }}
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] md:mt-10 md:grid md:grid-cols-4 md:gap-8 md:overflow-visible md:px-8"
      >
        {moments.map((m, i) => (
          <BlurFade key={m.title} inView delay={0.06 * i} className="w-[72vw] shrink-0 snap-start sm:w-[280px] md:w-auto">
            <article className="flex h-full flex-col">
              <h3 className="text-lg font-bold">
                <span className="mr-2 text-(--pub-paper-soft) tabular-nums">{i + 1}</span>
                {m.title}
              </h3>
              <p className="mt-1 text-[0.9375rem] text-(--pub-paper-soft)">{m.body}</p>
              <div className={cn("shrink-0", m.gap)} />
              {m.ui}
            </article>
          </BlurFade>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 md:px-8">
        <Button asChild size="lg" className="rounded-none">
          <Link href="/preorder">Start an order</Link>
        </Button>
        <p className="text-[0.9375rem]">{preorderLine(info) ?? " "}</p>
      </div>
    </section>
  );
}
