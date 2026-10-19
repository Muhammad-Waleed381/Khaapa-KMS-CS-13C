"use client";

import { useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { directionsUrl, getPosition, haversine, walkMinutes } from "./geo";
import type { ShopSettings } from "./types";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; metres: number } | { kind: "error"; message: string };

/** "How far am I?" as a coupon: one tap, the walk from where you stand to the counter. */
export function FindUs({ shop }: { shop?: ShopSettings }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const loc = shop?.location;

  async function check() {
    if (!loc) return;
    setState({ kind: "busy" });
    try {
      const me = await getPosition();
      setState({ kind: "done", metres: haversine(me, loc) });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  const km = state.kind === "done" && state.metres >= 1000;

  return (
    <section id="find-us" className="scroll-mt-4 bg-(--pub-tan) px-3 py-20 md:px-8 md:py-28">
      <BlurFade inView>
        <div className="coupon-notch mx-auto grid max-w-5xl bg-(--pub-green) text-(--pub-green-ink) [--cut:calc(12rem+2px)] md:grid-cols-[46fr_54fr] md:[--cut:46%]">
          {/* Fixed height on phones so the notches line up with the perforation below it. */}
          <div className="flex h-48 flex-col gap-4 p-7 md:h-auto md:p-12">
            <h2 className="font-display text-[2.75rem] md:text-[3.5rem]">
              How far is
              <br />
              the counter?
            </h2>
            <p className="max-w-[34ch]">{loc?.label ?? "K2 Block, NUST H-12"}</p>
          </div>

          {/* The perforation: a row of round dots in the ground colour. */}
          <div className="flex flex-col gap-3 border-t-[5px] border-dotted border-(--pub-tan) p-7 md:border-t-0 md:border-l-[5px] md:p-12">
            <div className="min-h-28" aria-live="polite">
              {state.kind === "done" ? (
                state.metres < 40 ? (
                  <p className="font-display text-6xl">You&apos;re here</p>
                ) : (
                  <>
                    <p className="font-display text-7xl tabular-nums md:text-8xl">
                      <NumberTicker
                        value={km ? state.metres / 1000 : Math.round(state.metres / 10) * 10}
                        decimalPlaces={km ? 1 : 0}
                        className="tracking-normal text-current"
                      />
                      <span className="ml-2">{km ? "km" : "m"}</span>
                    </p>
                    <p className="mt-1 text-lg">about {walkMinutes(state.metres)} min on foot</p>
                  </>
                )
              ) : state.kind === "error" ? (
                <p className="text-lg">{state.message}</p>
              ) : (
                <p className="font-display text-5xl text-(--pub-green-ink)/70">
                  {state.kind === "busy" ? "Finding you…" : "Tap to find out"}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={check}
              disabled={!loc || state.kind === "busy"}
              className="h-14 w-full rounded-none bg-(--pub-ground) text-base text-(--pub-ground-ink) hover:bg-(--pub-ground)/85"
            >
              {state.kind === "busy" ? "Locating…" : state.kind === "done" ? "Check again" : "How far am I?"}
            </Button>
            {loc && (
              <Button
                asChild
                size="lg"
                className="h-14 w-full rounded-none bg-(--pub-green-deep) text-base text-(--pub-green-ink) hover:bg-(--pub-green-deep)/80"
              >
                <a href={directionsUrl(loc)} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </Button>
            )}
            <p className="text-sm text-(--pub-green-ink)/80">Your location stays on your phone.</p>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}
