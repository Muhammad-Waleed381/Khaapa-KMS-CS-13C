"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import type { ShopSettings } from "./types";

const wa = (n: string) => `https://wa.me/${n.replace(/[^0-9]/g, "").replace(/^0/, "92")}`;

/** About, as a note from the people behind the counter, with a tear-off strip. */
export function Letter({ shop }: { shop?: ShopSettings }) {
  return (
    <section id="about" className="scroll-mt-4 bg-(--pub-clay) px-0 py-20 text-(--pub-paper-ink) md:px-8 md:py-28">
      <BlurFade inView className="mx-auto max-w-[640px]">
        <div className="edge-scallop-bottom bg-(--pub-paper) px-6 pt-12 pb-16 md:px-[60px] md:pt-[60px]">
          <div
            aria-hidden
            className="grid size-11 place-items-center rounded-full bg-(--pub-green) font-display text-lg text-(--pub-green-ink)"
          >
            KS
          </div>
          <div className="mt-7 space-y-5 text-[1.0625rem] leading-[1.55]">
            <p>We&apos;re SEECS students running a small shop between classes.</p>
            <p>
              The list above is live from our counter, so{" "}
              <span className="bg-(--pub-tan)/60 px-1">&ldquo;few left&rdquo; really means few left</span>.
            </p>
          </div>
          <p className="mt-8 text-[1.375rem] italic">The Khaapa SEECS team</p>
        </div>
        {/* Tear-off strip below a row of dots. */}
        <div className="border-t-[5px] border-dotted border-(--pub-clay) bg-(--pub-paper)">
          <div className="flex min-h-[72px] items-center px-6 py-4 md:px-[60px]">
            {shop?.whatsapp ? (
              <a href={wa(shop.whatsapp)} target="_blank" rel="noreferrer" className="font-semibold underline-offset-4 hover:underline">
                Questions? WhatsApp {shop.whatsapp}
              </a>
            ) : (
              <span className="font-semibold">Questions? Ask at the counter.</span>
            )}
          </div>
        </div>
      </BlurFade>
    </section>
  );
}
