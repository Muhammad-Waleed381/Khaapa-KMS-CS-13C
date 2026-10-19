"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionCard } from "@/components/kit";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { rs } from "@/lib/money";

type Mine = {
  holdings: unknown[];
  purchases: { status: string }[];
  offer: { open: boolean; pricePerShare: number; remaining: number; maxPerPerson: number };
};

// Where sign-in lands. Admins start on the Dashboard. Members who don't own or
// haven't requested shares yet are invited to buy some first; everyone else
// goes to the Counter.
export default function HomePage() {
  const { isAdmin, user } = useMe();
  const router = useRouter();
  const [invite, setInvite] = useState<Mine["offer"] | null>(null);

  useEffect(() => {
    if (isAdmin) return router.replace("/stats");
    let live = true;
    api<Mine>("/api/shares/mine")
      .then((m) => {
        if (!live) return;
        const started = m.holdings.length > 0 || m.purchases.some((p) => p.status === "pending" || p.status === "approved");
        if (started || !m.offer.open || m.offer.remaining <= 0) router.replace("/pos");
        else setInvite(m.offer);
      })
      // Offline or failed: don't block the counter.
      .catch(() => live && router.replace("/pos"));
    return () => {
      live = false;
    };
  }, [isAdmin, router]);

  if (!invite)
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );

  const first = user.name.split(/\s+/)[0];
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6 sm:py-12">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">Welcome, {first}</h1>
        <p className="mt-3 text-ink-soft">You&apos;re part of the Khaapa team. Start by owning a piece of the shop.</p>
      </div>

      <ActionCard
        icon={
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        title="Buy your shares"
        description={`${rs(invite.pricePerShare)} per share, up to ${invite.maxPerPerson}. You get your money back plus an equal part of the profit for every share.`}
        cta="Buy shares"
        href="/shares"
      />

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Choose how many", "Pick 1 to " + invite.maxPerPerson + " shares."],
          ["2", "Pay online", "Send the amount and take a screenshot."],
          ["3", "Get approved", "An admin checks it and adds your shares."],
        ].map(([n, title, text]) => (
          <li key={n} className="rounded-2xl border border-line bg-surface p-4">
            <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{n}</span>
            <div className="mt-3 font-medium">{title}</div>
            <div className="text-sm text-ink-soft">{text}</div>
          </li>
        ))}
      </ol>

      <div className="text-center">
        <Link href="/pos" className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Not now, go to the counter
        </Link>
      </div>
    </div>
  );
}
