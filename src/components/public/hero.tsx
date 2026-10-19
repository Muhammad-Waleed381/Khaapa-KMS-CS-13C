"use client";

import Link from "next/link";
import SplitText from "@/components/reactbits/split-text";
import { Button } from "@/components/ui/button";
import { fmtClock, fmtDate } from "@/lib/time";
import { ThemeToggle } from "@/components/theme";
import { HeroVideo, HeroVideoToggle, useHeroVideo } from "./hero-video";
import type { ShopInfo } from "./types";

// The folders behind the name: each one is a section of the page, and lends
// that section its ground colour. The front one (the rate list) is open.
const FOLDERS = [
  { href: "#about", label: "About", bg: "var(--pub-clay)", ink: "var(--pub-clay-ink)", tab: "left-[68%] md:left-[72%]" },
  { href: "#find-us", label: "Find us", bg: "var(--pub-tan)", ink: "var(--pub-paper-ink)", tab: "left-[40%] md:left-[50%]" },
  { href: "#order-ahead", label: "Order ahead", bg: "var(--pub-bone)", ink: "var(--pub-paper-ink)", tab: "left-[6%] md:left-[27%]" },
] as const;

export function preorderLine(info?: ShopInfo) {
  if (!info) return null;
  const day = info.days.find((d) => d.accepting);
  if (!day) return "Pre-orders are closed.";
  return day.date === info.days[0]?.date
    ? `Today's orders close at ${fmtClock(day.cutoff)}.`
    : `Taking orders for ${fmtDate(day.date)}.`;
}

export function Hero({ info }: { info?: ShopInfo }) {
  const { ref, motion, paused, setPaused, toggle } = useHeroVideo();
  return (
    <header className="relative flex min-h-[max(100svh,44rem)] flex-col bg-(--pub-ground) text-(--pub-ground-ink)">
      <HeroVideo videoRef={ref} motion={motion} onPausedChange={setPaused} />
      <nav className="relative z-10 flex items-center justify-between px-5 py-5 text-[0.9375rem] md:px-8">
        <div className="flex gap-5">
          <a href="#rate-list" className="underline-offset-4 hover:underline">
            Rate list
          </a>
          <a href="#order-ahead" className="hidden underline-offset-4 hover:underline sm:inline">
            Order ahead
          </a>
          <a href="#find-us" className="hidden underline-offset-4 hover:underline sm:inline">
            Find us
          </a>
        </div>
        <div className="flex items-center gap-4">
          <HeroVideoToggle motion={motion} paused={paused} onToggle={toggle} />
          <ThemeToggle className="rounded-full border border-current/30 hover:bg-current/10" />
          <Link href="/login" className="underline-offset-4 hover:underline">
            Staff login
          </Link>
        </div>
      </nav>

      <div className="relative px-5 pt-6 text-center md:pt-4">
        <SplitText
          tag="h1"
          text="Khaapa SEECS"
          trigger="load"
          splitType="chars"
          delay={35}
          duration={0.9}
          effect="rise"
          className="font-display text-[30vw] leading-[0.86] sm:text-[13.5vw] xl:text-[12.5rem]"
        />
        <p className="mx-auto mt-5 max-w-[44ch] text-base md:text-xl">The student-run tuck shop at NUST SEECS.</p>
      </div>

      {/* The stack starts at about half the screen and the front folder runs off the bottom. */}
      <div className="relative mt-auto h-[max(46svh,19rem)] [--step:52px] md:h-[max(44svh,20rem)] md:[--step:64px]">
        {FOLDERS.map((f, i) => (
          <a
            key={f.href}
            href={f.href}
            className="group absolute inset-x-0 bottom-0 mx-auto block w-full transition-transform duration-200 hover:-translate-y-2 md:w-[86%]"
            style={{ top: `calc(${i} * var(--step))`, background: f.bg, color: f.ink }}
            aria-label={`Go to ${f.label}`}
          >
            <span
              className={`absolute -top-8 flex h-8 items-center px-6 text-[0.9375rem] font-semibold md:-top-10 md:h-10 md:px-8 md:text-lg ${f.tab}`}
              style={{ background: f.bg, clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)" }}
            >
              {f.label}
            </span>
          </a>
        ))}
        <div
          className="absolute inset-x-0 bottom-0 mx-auto w-full bg-(--pub-green) text-(--pub-green-ink) md:w-[86%]"
          style={{ top: `calc(3 * var(--step))` }}
        >
          <span
            className="absolute -top-8 left-[4%] flex h-8 items-center bg-(--pub-green) px-6 text-[0.9375rem] font-semibold md:-top-10 md:h-10 md:px-8 md:text-lg"
            style={{ clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)" }}
          >
            Rate list
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5 md:p-8">
            <Button
              asChild
              size="lg"
              className="w-full rounded-none bg-(--pub-ground) text-(--pub-ground-ink) hover:bg-(--pub-ground)/85 sm:w-auto"
            >
              <Link href="/preorder">Order ahead</Link>
            </Button>
            <p className="text-[0.9375rem]">{preorderLine(info) ?? " "}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
