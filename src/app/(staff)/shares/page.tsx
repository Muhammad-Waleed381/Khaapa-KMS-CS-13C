"use client";

import { useState } from "react";
import { Meter } from "@/components/charts";
import { EmptyState, Explainer, KpiRow, KpiTile, Section, Steps } from "@/components/kit";
import { toast } from "@/components/toast";
import { Badge, Button, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtDate, fmtDateTime, pkDate } from "@/lib/time";
import { BuyFlow } from "./buy-flow";
import { plural, ProofModal, rsRound, STATUS_WORDS, type Mine, type Purchase } from "./shared";

// Everyone's own shares, admins included: what I own, what I'd get back, and
// buying more. Running the share sale lives on /shares/manage.
export default function MySharesPage() {
  const mine = useApi<Mine>("/api/shares/mine");
  const d = mine.data;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader title="My shares" sub="Your part of Khaapa, and buying more." />
      <StaleNote stale={mine.stale} />

      {!d ? (
        <div className="grid place-items-center py-16">{mine.error ? <EmptyState title={mine.error} /> : <Spinner />}</div>
      ) : (
        <>
          <Ownership d={d} />
          <Requests purchases={d.purchases} reload={mine.reload} />
          <Buy d={d} reload={mine.reload} />
          <Holdings d={d} />
        </>
      )}
    </div>
  );
}

function Ownership({ d }: { d: Mine }) {
  if (d.totals.shares === 0)
    return (
      <Explainer>
        <b className="text-ink">What&apos;s a share?</b> Khaapa&apos;s profit is split equally between all shares. Buy a share
        for {rs(d.offer.pricePerShare)} and you get your money back plus your share of the profit.
      </Explainer>
    );
  return (
    <Section
      title={`You own ${plural(d.totals.shares, "share")}`}
      description={`Profit is split equally between all ${plural(d.totalShares, "share")}: ${rsRound(d.profitPerShare)} per share so far.`}
    >
      <KpiRow>
        <KpiTile label="Shares you own" value={d.totals.shares} hint={`of ${d.totalShares} in total`} />
        <KpiTile label="Money you put in" value={rs(d.totals.invested)} />
        <KpiTile label="Your profit so far" value={rsRound(d.totals.estimatedProfit)} />
        <KpiTile label="You'd get back today" value={rsRound(d.totals.payout)} hint="Money in + profit" />
      </KpiRow>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Meter
          value={d.totals.shares}
          max={Math.max(d.totalShares, d.totals.shares)}
          label={`Your part of Khaapa: ${d.totalShares ? Math.round((d.totals.shares / d.totalShares) * 100) : 0}%`}
        />
      </div>
    </Section>
  );
}

/** Each request as a small timeline: sent → checked → shares added. */
function Requests({ purchases, reload }: { purchases: Purchase[]; reload: () => void }) {
  const [proofOf, setProofOf] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const open = purchases.filter((p) => p.status === "pending");
  const done = purchases.filter((p) => p.status !== "pending");
  const shown = showOld ? [...open, ...done] : [...open, ...done.slice(0, open.length ? 0 : 1)];
  if (!purchases.length) return null;

  const cancel = async (p: Purchase) => {
    if (!confirm(`Cancel your request for ${plural(p.shares, "share")}?`)) return;
    try {
      await api(`/api/share-purchases/${p.id}/cancel`, { method: "POST" });
      toast("Request cancelled");
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <Section
      title="Your requests"
      action={
        done.length > (open.length ? 0 : 1) && (
          <Button size="sm" variant="ghost" onClick={() => setShowOld(!showOld)}>
            {showOld ? "Show less" : `Show all (${purchases.length})`}
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {shown.map((p) => (
          <div key={p.id} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {plural(p.shares, "share")} · {rs(p.total)}
                </div>
                <div className="text-sm text-ink-soft">
                  {rs(p.pricePerShare)} each · sent {fmtDateTime(p.createdAt)}
                </div>
              </div>
              <Badge tone={p.status === "approved" ? "good" : p.status === "pending" ? "warn" : p.status === "rejected" ? "bad" : "neutral"}>
                {STATUS_WORDS[p.status]}
              </Badge>
            </div>

            {(p.status === "pending" || p.status === "approved") && (
              <Steps
                current={p.status === "pending" ? 1 : 3}
                steps={[
                  { title: "Request sent", description: fmtDate(pkDate(p.createdAt)) },
                  { title: "Payment checked", description: p.status === "pending" ? "An admin is checking" : "Done" },
                  { title: "Shares added", description: p.decidedAt ? fmtDate(pkDate(p.decidedAt)) : "Soon" },
                ]}
              />
            )}
            {p.status === "rejected" && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                {p.note ? <>Reason: {p.note}</> : "An admin couldn't confirm this payment."} Message an admin if you think
                this is a mistake.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {p.hasProof && (
                <Button size="sm" variant="ghost" onClick={() => setProofOf(p.id)}>
                  See screenshot
                </Button>
              )}
              {p.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => cancel(p)}>
                  Cancel request
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <ProofModal id={proofOf} onClose={() => setProofOf(null)} />
    </Section>
  );
}

function Buy({ d, reload }: { d: Mine; reload: () => void }) {
  const o = d.offer;
  return (
    <Section
      title="Buy shares"
      description={o.open ? `${rs(o.pricePerShare)} per share · up to ${plural(o.maxPerPerson, "share")} per person.` : undefined}
    >
      {!o.open ? (
        <EmptyState title="Shares aren't on sale right now" description="Admins will open them when there's a new round." />
      ) : o.remaining <= 0 ? (
        <EmptyState
          title="You've reached the limit"
          description={`Each person can have up to ${plural(o.maxPerPerson, "share")}, counting requests still waiting for approval.`}
        />
      ) : !o.account ? (
        <EmptyState title="Not ready yet" description="No payment account is set for shares. Ask an admin." />
      ) : (
        <BuyFlow offer={o} onDone={reload} />
      )}
    </Section>
  );
}

/** One block per share, grouped by purchase, so ownership is visible at a glance. */
function Holdings({ d }: { d: Mine }) {
  if (!d.holdings.length) return null;
  return (
    <Section title="Your holdings" description="Each purchase keeps the price it was bought at.">
      <ul className="space-y-3">
        {d.holdings.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: Math.min(h.shares, 10) }, (_, i) => (
                <span key={i} className="size-6 rounded-md bg-[var(--series-1)]" />
              ))}
              {h.shares > 10 && <span className="self-center text-xs text-ink-faint">+{h.shares - 10}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {plural(h.shares, "share")} at {rs(h.pricePerShare)}
              </div>
              <div className="text-sm text-ink-soft">Since {fmtDate(h.boughtOn)}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{rs(h.shares * h.pricePerShare)}</div>
              <div className="text-xs text-ink-faint">put in</div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
