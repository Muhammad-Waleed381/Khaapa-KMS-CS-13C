"use client";

import { Banknote, Check, ChevronLeft, ChevronRight, Copy, Share2, TriangleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BarList, SplitBar } from "@/components/charts";
import { Disclosure, EmptyState, KpiRow, KpiTile, Section } from "@/components/kit";
import { toast } from "@/components/toast";
import { Button, Card, cx, Input, PageHeader, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { addDays, fmtClock, fmtDate, pkDate, pkTime } from "@/lib/time";
import { Avatar, rsWhole } from "../stats/bits";

type Report = {
  date: string;
  totals: { total: number; cash: number; online: number; count: number; voids: number; cogs: number; grossProfit: number };
  expectedCash: number;
  onlineByAccount: { accountId: string | null; label: string | null; provider: string | null; total: number; count: number }[];
  itemsSold: { itemId: string; name: string; qty: number; revenue: number; cost: number; profit: number }[];
  oversold: { saleId: string; name: string; qty: number; at: string }[];
  writeOffs: { name: string; kind: string; qty: number; cost: number; note: string | null; by: string | null }[];
  writeOffTotal: number;
  restocks: { name: string; qty: number; cost: number; supplier: string | null; by: string | null }[];
  restockTotal: number;
  shifts: { name: string; startedAt: string; endedAt: string | null }[];
  preorders: { code: string; customerName: string; total: number }[];
};

const accountName = (a: Report["onlineByAccount"][number]) =>
  a.accountId ? `${a.label}${a.provider ? ` (${a.provider})` : ""}` : "Account not recorded";

/** Plain text for WhatsApp: short lines, no emoji, *bold* headings. */
function toText(r: Report) {
  const out = [
    `*Khaapa day report — ${fmtDate(r.date)}*`,
    "",
    `Sales: ${rs(r.totals.total)} (${r.totals.count} sales${r.totals.voids ? `, ${r.totals.voids} voided` : ""})`,
    `Cash in the drawer: ${rs(r.expectedCash)}`,
    `Online: ${rs(r.totals.online)}`,
    ...(r.onlineByAccount.length > 1 || r.onlineByAccount.some((a) => a.accountId)
      ? r.onlineByAccount.map((a) => `  ${accountName(a)}: ${rs(a.total)}`)
      : []),
    `Profit: ${rs(r.totals.grossProfit)} (stock cost ${rs(r.totals.cogs)})`,
  ];
  if (r.itemsSold.length) {
    out.push("", "*Items sold*");
    for (const i of r.itemsSold) out.push(`${i.qty} x ${i.name} — ${rs(i.revenue)}`);
  }
  if (r.oversold.length) {
    out.push("", "*Sold while out of stock*");
    for (const o of r.oversold) out.push(`${o.qty} x ${o.name} at ${pkTime(o.at)}`);
  }
  if (r.restocks.length) {
    out.push("", `*Restocked* (${rs(r.restockTotal)})`);
    for (const x of r.restocks) out.push(`${x.qty} x ${x.name} — ${rs(x.cost)}${x.supplier ? ` from ${x.supplier}` : ""}`);
  }
  if (r.writeOffs.length) {
    out.push("", `*Written off* (${rs(r.writeOffTotal)})`);
    for (const w of r.writeOffs) out.push(`${w.qty} x ${w.name}${w.note ? ` — ${w.note}` : ""}`);
  }
  if (r.preorders.length) {
    out.push("", "*Pre-orders collected*");
    for (const p of r.preorders) out.push(`${p.code} ${p.customerName} — ${rs(p.total)}`);
  }
  if (r.shifts.length) {
    out.push("", "*On the counter*");
    for (const s of r.shifts) out.push(`${s.name}: ${pkTime(s.startedAt)}–${s.endedAt ? pkTime(s.endedAt) : "still on"}`);
  }
  return out.join("\n");
}

export default function ReportPage() {
  const [date, setDate] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [allItems, setAllItems] = useState(false);
  // Before the shop opens, the day to close is yesterday.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDate(Number(pkTime().slice(0, 2)) < 8 ? addDays(pkDate(), -1) : pkDate()), []);
  const { data: r, error, stale } = useApi<Report>(date ? `/api/report?date=${date}` : null);
  const today = date ? pkDate() : "";

  function pick(d: string) {
    setDate(d);
    setChecked({});
    setAllItems(false);
  }

  async function share() {
    if (!r) return;
    const text = toText(r);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        setChecked((c) => ({ ...c, share: true }));
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setChecked((c) => ({ ...c, share: true }));
  }

  async function copy() {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(toText(r));
      toast("Report copied");
    } catch {
      toast("Couldn't copy", "bad");
    }
  }

  const problems = r ? r.totals.voids + r.oversold.length + r.writeOffs.length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-10">
      <div>
        <PageHeader title="Day report" sub="Close the day: check the money, then share the report with the team." />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => date && pick(addDays(date, -1))} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            aria-label="Day"
            className="w-44"
            value={date ?? ""}
            max={today}
            onChange={(e) => e.target.value && pick(e.target.value)}
          />
          <Button size="sm" disabled={date === today} onClick={() => date && pick(addDays(date, 1))} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
          {date && date !== today && (
            <Button size="sm" variant="ghost" onClick={() => pick(today)}>
              Today
            </Button>
          )}
        </div>
        <div className="mt-4">
          <StaleNote stale={stale} />
        </div>
        {error && !r && <EmptyState title="Couldn't load the report" description={error} />}
      </div>

      {r && (
        <>
          {/* The one number that matters at closing time */}
          <div className="rounded-3xl border border-primary/20 bg-primary-soft/60 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <Banknote className="size-4" /> Money that should be in the drawer
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-ink sm:text-5xl">{rs(r.expectedCash)}</div>
            <p className="mt-2 text-sm text-ink-soft">
              All cash sales on {fmtDate(r.date)}. Count the drawer — it should match this.
            </p>
          </div>

          {/* Closing checklist */}
          <Section title="Closing checklist" description="Tick each step as you go.">
            <ol className="space-y-3">
              <CheckStep
                n={1}
                done={!!checked.cash}
                onToggle={() => setChecked((c) => ({ ...c, cash: !c.cash }))}
                title={`Count the drawer: ${rs(r.expectedCash)}`}
                description="If it doesn't match, check Sales for voids or a sale rung up as cash by mistake."
              />
              <CheckStep
                n={2}
                done={!!checked.online}
                onToggle={() => setChecked((c) => ({ ...c, online: !c.online }))}
                title={`Check online payments: ${rs(r.totals.online)}`}
                description={
                  r.onlineByAccount.length
                    ? "Open each account's app and check it received the amount below."
                    : "No online payments today."
                }
              >
                {r.onlineByAccount.length > 0 && (
                  <div className="mt-4">
                    <SplitBar
                      parts={r.onlineByAccount.map((a, i) => ({
                        label: accountName(a),
                        value: a.total,
                        color: a.accountId && i < 3 ? undefined : "var(--series-muted)",
                      }))}
                      format={rs}
                    />
                  </div>
                )}
              </CheckStep>
              <CheckStep
                n={3}
                done={!!checked.share}
                onToggle={() => setChecked((c) => ({ ...c, share: !c.share }))}
                title="Share the report with the team"
                description="Sends a short summary to WhatsApp."
              >
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="lg" onClick={share}>
                    <Share2 className="size-4" /> Share report
                  </Button>
                  <Button size="lg" onClick={copy}>
                    <Copy className="size-4" /> Copy text
                  </Button>
                </div>
              </CheckStep>
            </ol>
          </Section>

          <Section title="The day in numbers">
            <KpiRow>
              <KpiTile label="Sales" value={rs(r.totals.total)} hint={`${r.totals.count} sales`} />
              <KpiTile label="Profit" value={rsWhole(r.totals.grossProfit)} hint="Sales minus what the stock cost" />
              <KpiTile label="Cash" value={rs(r.totals.cash)} />
              <KpiTile label="Online" value={rs(r.totals.online)} />
            </KpiRow>
          </Section>

          <Section title="What sold" description={r.itemsSold.length ? "By number sold." : undefined}>
            {r.itemsSold.length ? (
              <Card className="space-y-4 border border-line p-5">
                <BarList
                  rows={r.itemsSold.map((i) => ({ label: i.name, value: i.qty, hint: `${rs(i.revenue)} · ${rs(i.profit)} profit` }))}
                  format={(v) => `${v} sold`}
                  max={allItems ? undefined : 7}
                />
                {r.itemsSold.length > 7 && (
                  <Button size="sm" variant="ghost" onClick={() => setAllItems(!allItems)}>
                    {allItems ? "Show fewer" : `Show all ${r.itemsSold.length} items`}
                  </Button>
                )}
              </Card>
            ) : (
              <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-ink-soft">Nothing was sold on this day.</p>
            )}
          </Section>

          {problems > 0 && (
            <Section title="Things to look at" description="Not necessarily wrong, but worth a glance.">
              <div className="space-y-3">
                {r.totals.voids > 0 && (
                  <Problem title={`${r.totals.voids} ${r.totals.voids === 1 ? "sale was" : "sales were"} voided`} description="See who and why on the Sales page." />
                )}
                {r.oversold.length > 0 && (
                  <Problem
                    title={`${r.oversold.reduce((s, o) => s + o.qty, 0)} sold while the shelf showed none`}
                    description={r.oversold.map((o) => `${o.qty}× ${o.name}`).join(", ") + ". Check the stock count for these."}
                  />
                )}
                {r.writeOffs.length > 0 && (
                  <Problem
                    title={`${rs(r.writeOffTotal)} of stock thrown away or missing`}
                    description={r.writeOffs.map((w) => `${w.qty}× ${w.name}${w.note ? ` (${w.note})` : ""}`).join(", ")}
                  />
                )}
              </div>
            </Section>
          )}

          <Section title="Who worked">
            {r.shifts.length ? (
              <div className="flex flex-wrap gap-3">
                {r.shifts.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                    <Avatar name={s.name} />
                    <div>
                      <div className="text-sm font-medium text-ink">{s.name}</div>
                      <div className="text-xs text-ink-soft tabular-nums">
                        {fmtClock(pkTime(s.startedAt))} – {s.endedAt ? fmtClock(pkTime(s.endedAt)) : "still on"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-ink-soft">Nobody started a shift on this day.</p>
            )}
          </Section>

          {(r.restocks.length > 0 || r.preorders.length > 0) && (
            <div className="space-y-3">
              {r.restocks.length > 0 && (
                <Disclosure summary={`Restocked: ${r.restocks.length} ${r.restocks.length === 1 ? "item" : "items"} for ${rs(r.restockTotal)}`}>
                  <Rows rows={r.restocks.map((x) => [`${x.qty}× ${x.name}${x.supplier ? ` from ${x.supplier}` : ""}`, rs(x.cost)])} />
                </Disclosure>
              )}
              {r.preorders.length > 0 && (
                <Disclosure summary={`Pre-orders collected: ${r.preorders.length}`}>
                  <Rows rows={r.preorders.map((p) => [`${p.code} · ${p.customerName}`, rs(p.total)])} />
                </Disclosure>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CheckStep({
  n,
  done,
  onToggle,
  title,
  description,
  children,
}: {
  n: number;
  done: boolean;
  onToggle: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={cx("rounded-2xl border bg-surface p-4 transition sm:p-5", done ? "border-primary/40" : "border-line")}>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Step ${n} done` : `Mark step ${n} done`}
          className={cx(
            "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition",
            done ? "bg-primary text-primary-foreground" : "bg-muted text-ink-soft hover:bg-primary-soft hover:text-primary",
          )}
        >
          {done ? <Check className="size-4" /> : n}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cx("font-medium text-ink", done && "text-ink-soft")}>{title}</div>
          {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          {children}
        </div>
      </div>
    </li>
  );
}

function Problem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/8 p-4">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map(([a, b], i) => (
        <li key={i} className="flex justify-between gap-4 py-2">
          <span className="text-ink">{a}</span>
          <span className="shrink-0 tabular-nums text-ink-soft">{b}</span>
        </li>
      ))}
    </ul>
  );
}

