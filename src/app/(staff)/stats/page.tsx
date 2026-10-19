"use client";

import Link from "next/link";
import { useState } from "react";
import { BarList, ColumnChart, SplitBar } from "@/components/charts";
import { Disclosure, EmptyState, KpiRow, KpiTile, Section } from "@/components/kit";
import { Badge, Button, Card, PageHeader, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate, pkTime, WEEKDAYS, weekday } from "@/lib/time";
import { pctChange, rsWhole, Segmented, toRupees } from "./bits";

type Range = "today" | "7d" | "30d" | "all";

type DaySoFar = { revenue: number; cash: number; online: number; salesCount: number; grossProfit: number };
type Recent = { day: string; revenue: number; cash: number; online: number; profit: number };

type Stats = {
  range: Range;
  summary: {
    revenue: number;
    cash: number;
    online: number;
    salesCount: number;
    voidedCount: number;
    cogs: number;
    writeOffs: number;
    costs: number;
    grossProfit: number;
    netProfit: number;
  };
  stockValue: number;
  daily: { day: string; revenue: number; profit: number; cash: number; online: number; count: number }[];
  hourly: { hour: number; revenue: number; count: number }[];
  topItems: { itemId: string; name: string; qty: number; revenue: number; cost: number }[];
  byCashier: { userId: string; name: string; count: number; revenue: number; cash: number; online: number }[];
  lowStock: { id: string; name: string; stock: number; lowStockAt: number }[];
  accounts: { accountId: string | null; label: string | null; provider: string | null; total: number; count: number }[];
  today: { date: string; asOf: string; today: DaySoFar; yesterday: DaySoFar; lastWeek: DaySoFar };
  recent: Recent[];
};

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const RANGE_WORDS: Record<Range, string> = { today: "today", "7d": "in the last 7 days", "30d": "in the last 30 days", all: "so far" };

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

export default function DashboardPage() {
  const { isAdmin } = useMe();
  const [range, setRange] = useState<Range>("7d");
  const [allItems, setAllItems] = useState(false);
  const { data, error, stale } = useApi<Stats>(isAdmin ? `/api/stats?range=${range}` : null);

  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md pt-10">
        <EmptyState
          title="The dashboard is for admins"
          description="You can sell, restock and see today's report from the Counter."
          action={
            <Link href="/pos">
              <Button variant="primary">Go to the Counter</Button>
            </Link>
          }
        />
      </div>
    );

  const t = data?.today;
  const s = data?.summary;
  const lastWeekday = t ? WEEKDAYS[weekday(t.date)] : "";
  const recent = data?.recent ?? [];
  const nothingYet = data && data.summary.salesCount === 0 && data.summary.voidedCount === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-10">
      <div>
        <PageHeader title="Dashboard" sub="How the shop is doing, at a glance." />
        <StaleNote stale={stale} />
        {error && !data && <EmptyState title="Couldn't load the dashboard" description={error} />}
      </div>

      {/* Today */}
      <Section
        title="Today so far"
        description={t ? `Compared with last ${lastWeekday} up to ${fmtClock(pkTime(t.asOf))}.` : "Loading…"}
      >
        <KpiRow>
          <KpiTile
            label="Sales"
            value={rsWhole(t?.today.revenue)}
            delta={t ? pctChange(t.today.revenue, t.lastWeek.revenue) : undefined}
            deltaLabel="vs last week"
            hint={t ? `${t.today.salesCount} ${t.today.salesCount === 1 ? "sale" : "sales"}` : undefined}
            trend={recent.map((d) => d.revenue)}
          />
          <KpiTile
            label="Profit"
            value={rsWhole(t?.today.grossProfit)}
            delta={t ? pctChange(t.today.grossProfit, t.lastWeek.grossProfit) : undefined}
            deltaLabel="vs last week"
            hint="Sales minus what the stock cost"
            trend={recent.map((d) => d.profit)}
          />
          <KpiTile
            label="Cash"
            value={rsWhole(t?.today.cash)}
            delta={t ? pctChange(t.today.cash, t.lastWeek.cash) : undefined}
            deltaLabel="vs last week"
            trend={recent.map((d) => d.cash)}
          />
          <KpiTile
            label="Online"
            value={rsWhole(t?.today.online)}
            delta={t ? pctChange(t.today.online, t.lastWeek.online) : undefined}
            deltaLabel="vs last week"
            trend={recent.map((d) => d.online)}
          />
        </KpiRow>
        <p className="text-xs text-ink-faint">The small lines show the last 7 days.</p>
      </Section>

      {/* Trends */}
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-8">
          <div>
            <h2 className="text-xl font-semibold text-ink">Trends</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Pick a period. Everything below follows it.</p>
          </div>
          <Segmented label="Period" options={RANGES} value={range} onChange={setRange} />
        </div>

        {nothingYet ? (
          <EmptyState title="No sales in this period" description="Sales rung up at the Counter show here." />
        ) : (
          <>
            <KpiRow>
              <KpiTile label="Sales" value={rsWhole(s?.revenue)} hint={s ? `${s.salesCount} sales ${RANGE_WORDS[range]}` : undefined} />
              <KpiTile label="Profit" value={rsWhole(s?.netProfit)} hint="After stock cost, waste and running costs" />
              <KpiTile
                label="Average sale"
                value={rsWhole(s && s.salesCount ? s.revenue / s.salesCount : 0)}
                hint="What one customer spends"
              />
              <KpiTile label="Stock on the shelf" value={rsWhole(data?.stockValue)} hint="What it cost us" />
            </KpiRow>

            {s && (
              <Disclosure summary="How the profit is worked out">
                <ul className="space-y-2 text-sm">
                  <Line label="Sales" value={rs(s.revenue)} />
                  <Line label="minus what the sold stock cost" value={`− ${rs(s.cogs)}`} />
                  <Line label="minus stock thrown away or missing" value={`− ${rs(s.writeOffs)}`} />
                  <Line label="minus running costs (transport, bags…)" value={`− ${rs(s.costs)}`} />
                  <Line label="Profit" value={rs(s.netProfit)} strong />
                </ul>
                <p className="mt-3 text-xs text-ink-faint">Stock cost uses the oldest batch first, at the price it was bought for.</p>
              </Disclosure>
            )}

            {data && range !== "today" && data.daily.length > 1 && (
              <Card className="space-y-4 border border-line p-5">
                <div>
                  <h3 className="text-base font-semibold">Sales and profit per day</h3>
                  <p className="text-sm text-ink-soft">Hover or tap a day to see its numbers.</p>
                </div>
                <ColumnChart
                  data={data.daily.map((d) => ({
                    label: range === "7d" ? WEEKDAYS[weekday(d.day)] : d.day.slice(8).replace(/^0/, ""),
                    hint: fmtDate(d.day),
                    values: { revenue: d.revenue, profit: Math.max(d.profit, 0) },
                  }))}
                  series={[
                    { key: "revenue", label: "Sales" },
                    { key: "profit", label: "Profit" },
                  ]}
                  format={rs}
                  toAxis={toRupees}
                />
              </Card>
            )}

            {data && <BusyHours hourly={data.hourly} />}

            {data && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="space-y-4 border border-line p-5">
                  <div>
                    <h3 className="text-base font-semibold">Best sellers</h3>
                    <p className="text-sm text-ink-soft">By number sold.</p>
                  </div>
                  {data.topItems.length ? (
                    <>
                      <BarList
                        rows={data.topItems.map((i) => ({ label: i.name, value: i.qty, hint: `${rs(i.revenue)} sales · ${rs(i.revenue - i.cost)} profit` }))}
                        format={(v) => `${v} sold`}
                        max={allItems ? undefined : 5}
                      />
                      {data.topItems.length > 5 && (
                        <Button size="sm" variant="ghost" onClick={() => setAllItems(!allItems)}>
                          {allItems ? "Show top 5" : `Show top ${data.topItems.length}`}
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-ink-faint">Nothing sold yet.</p>
                  )}
                </Card>

                <Card className="space-y-4 border border-line p-5">
                  <div>
                    <h3 className="text-base font-semibold">Who sold the most</h3>
                    <p className="text-sm text-ink-soft">Money taken at the counter.</p>
                  </div>
                  {data.byCashier.length ? (
                    <BarList
                      rows={data.byCashier.map((c) => ({ label: c.name, value: c.revenue, hint: `${c.count} sales` }))}
                      format={rs}
                      color="var(--series-2)"
                      max={6}
                    />
                  ) : (
                    <p className="text-sm text-ink-faint">Nobody has sold yet.</p>
                  )}
                </Card>
              </div>
            )}

            {s && (
              <Card className="space-y-6 border border-line p-5">
                <div>
                  <h3 className="text-base font-semibold">How customers paid</h3>
                  <p className="text-sm text-ink-soft">Cash goes in the drawer; online goes to a payment account.</p>
                </div>
                <SplitBar
                  parts={[
                    { label: "Cash", value: s.cash },
                    { label: "Online", value: s.online },
                  ]}
                  format={rs}
                />
                {data && data.accounts.length > 0 && (
                  <div className="space-y-3 border-t border-line pt-5">
                    <div className="text-sm font-medium text-ink">Online money by account</div>
                    <SplitBar
                      parts={data.accounts.map((a, i) => ({
                        label: a.accountId ? `${a.label}${a.provider ? ` (${a.provider})` : ""}` : "Not recorded",
                        value: a.total,
                        // Only three validated colours; the rest (and "not recorded") are grey.
                        color: a.accountId && i < 3 ? undefined : "var(--series-muted)",
                      }))}
                      format={rs}
                    />
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {data && <LowStock items={data.lowStock} />}
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className={strong ? "flex justify-between border-t border-line pt-2 font-semibold text-ink" : "flex justify-between text-ink-soft"}>
      <span>{label}</span>
      <span className="tabular-nums text-ink">{value}</span>
    </li>
  );
}

/** "When are we busy": sales by hour across the shop's hours. */
function BusyHours({ hourly }: { hourly: Stats["hourly"] }) {
  const active = hourly.filter((h) => h.count > 0).map((h) => h.hour);
  if (!active.length) return null;
  const from = Math.min(8, ...active);
  const to = Math.max(17, ...active);
  const hours = hourly.filter((h) => h.hour >= from && h.hour <= to);
  const busiest = [...hours].sort((a, b) => b.revenue - a.revenue)[0];
  return (
    <Card className="space-y-4 border border-line p-5">
      <div>
        <h3 className="text-base font-semibold">When are we busy?</h3>
        <p className="text-sm text-ink-soft">
          Sales by hour of the day. Busiest: <b className="font-medium text-ink">{hourLabel(busiest.hour)}–{hourLabel(busiest.hour + 1)}</b>.
        </p>
      </div>
      <ColumnChart
        data={hours.map((h) => ({
          // Short labels fit on phones; the tooltip has the full hour.
          label: String(h.hour % 12 || 12),
          hint: `${hourLabel(h.hour)}–${hourLabel(h.hour + 1)} · ${h.count} sales`,
          values: { revenue: h.revenue },
        }))}
        series={[{ key: "revenue", label: "Sales" }]}
        format={rs}
        toAxis={toRupees}
        height={150}
        labelEvery={2}
      />
    </Card>
  );
}

function LowStock({ items }: { items: Stats["lowStock"] }) {
  const shown = items.slice(0, 6);
  return (
    <Section
      title="Running low"
      description={items.length ? "These need restocking soon." : undefined}
      action={
        <Link href="/items" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Restock in Items →
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-ink-soft">✓ Everything is above its low-stock level.</p>
      ) : (
        <Card className="divide-y divide-line border border-line">
          {shown.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-ink">{i.name}</span>
              <Badge tone={i.stock <= 0 ? "bad" : "warn"}>
                {i.stock < 0 ? `⚠ ${-i.stock} sold without stock` : i.stock === 0 ? "⚠ Out of stock" : `${i.stock} left`}
              </Badge>
            </div>
          ))}
          {items.length > shown.length && (
            <Link href="/items" className="block px-4 py-3 text-sm text-ink-soft hover:text-ink">
              and {items.length - shown.length} more…
            </Link>
          )}
        </Card>
      )}
    </Section>
  );
}
