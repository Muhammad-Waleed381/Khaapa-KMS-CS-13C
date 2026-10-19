"use client";

import { useMemo, useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { rs } from "@/lib/money";
import type { PublicItem } from "./types";

const AVAIL = { in: null, few: "Few left", out: "Sold out" } as const;

/** The rate list, set like the printed sheet behind the counter, but live. */
export function RateSheet({
  items,
  loading,
  stale,
}: {
  items: PublicItem[];
  loading: boolean;
  stale: boolean;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, PublicItem[]>();
    for (const i of items) m.set(i.category, [...(m.get(i.category) ?? []), i]);
    return [...m];
  }, [items]);
  const withImages = items.filter((i) => i.image);
  const [hover, setHover] = useState<PublicItem | null>(null);
  const shown = hover?.image ? hover : null;
  const inStock = items.filter((i) => i.availability !== "out").length;

  return (
    <section id="rate-list" className="scroll-mt-4 bg-(--pub-green) px-2.5 pt-10 pb-20 md:px-8 md:pt-16 md:pb-28">
      <div
        className={cn(
          "mx-auto grid max-w-6xl items-start gap-10",
          withImages.length > 0 ? "lg:grid-cols-[1fr_640px]" : "justify-items-center",
        )}
      >
        {withImages.length > 0 && (
          // The frame the hovered item's picture appears in (pointer devices only).
          <div className="sticky top-10 hidden aspect-[4/5] w-full max-w-md justify-self-end overflow-hidden bg-(--pub-green-deep) lg:block">
            {withImages.map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i.id}
                src={i.image!}
                alt={i.name}
                loading="lazy"
                className={cn(
                  "absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-[240ms] motion-reduce:transition-none",
                  shown?.id === i.id && "opacity-100",
                )}
              />
            ))}
            <p
              className={cn(
                "absolute inset-x-0 bottom-0 p-6 font-display text-4xl text-(--pub-green-ink) transition-opacity duration-[240ms]",
                shown && "opacity-0",
              )}
            >
              Point at an item
            </p>
          </div>
        )}

        <div className="edge-scallop w-full max-w-[640px] bg-(--pub-paper) px-7 py-14 text-(--pub-paper-ink) md:px-16 md:py-16">
          <BlurFade inView className="text-center">
            <h2 className="font-display text-[2.75rem] md:text-5xl">Rate list</h2>
            <p className="mt-3 text-[0.9375rem] text-(--pub-paper-soft)">
              {loading && !items.length
                ? "Loading…"
                : stale
                  ? "Offline copy"
                  : `Live · ${inStock} of ${items.length} in stock`}
            </p>
          </BlurFade>

          {loading && !items.length ? (
            <div className="mx-auto mt-12 max-w-[420px] space-y-5">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full bg-(--pub-paper-ink)/8" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="mt-12 text-center">Empty shelf. Back after the next restock.</p>
          ) : (
            <div className="mx-auto mt-12 max-w-[420px] space-y-10" onPointerLeave={() => setHover(null)}>
              {groups.map(([cat, list]) => (
                <BlurFade key={cat} inView>
                  <h3 className="text-center font-display text-[1.375rem] md:text-2xl">{cat}</h3>
                  <ul className="mt-4 space-y-3">
                    {list.map((i) => (
                      <li
                        key={i.id}
                        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
                        className={cn(
                          "flex items-start gap-3 transition-opacity duration-200",
                          hover && hover.id !== i.id && "[@media(hover:hover)]:opacity-45",
                        )}
                      >
                        {i.image && (
                          // On touch screens the picture sits inline instead of in the frame.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" loading="lazy" className="size-12 shrink-0 object-cover lg:hidden" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-4 text-[1.0625rem]">
                            <span className={cn("font-semibold", i.availability === "out" && "text-(--pub-paper-soft)")}>
                              {i.name}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 font-semibold tabular-nums",
                                i.availability === "out" && "text-(--pub-paper-soft) line-through",
                              )}
                            >
                              {rs(i.price)}
                            </span>
                          </div>
                          {AVAIL[i.availability] && (
                            <div
                              className={cn(
                                "text-sm",
                                i.availability === "few" && "font-semibold text-warn",
                                i.availability === "out" && "text-destructive",
                              )}
                            >
                              {AVAIL[i.availability]}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </BlurFade>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
