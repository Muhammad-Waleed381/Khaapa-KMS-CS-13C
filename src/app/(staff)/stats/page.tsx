"use client";

import { useState } from "react";
import { Badge, Card, cx, Empty, PageHeader, StaleNote, Stat } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtDate } from "@/lib/time";

type Range = "today" | "7d" | "30d" | "all";

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
  daily: { day: string; revenue: number; profit: number }[];
  hourly: { hour: number; revenue: number; count: number }[];
  topItems: { itemId: string; name: string; qty: number; revenue: number; cost: number }[];
  byCashier: { userId: string; name: string; count: number; revenue: number; cash: number; online: number }[];
  lowStock: { id: string; name: string; stock: number; lowStockAt: number }[];
};

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

export default function StatsPage() {
  const [range, setRange] = useState<Range>("today");
  const { data, error, stale } = useApi<Stats>(`/api/stats?range=${range}`);
  const s = data?.summary;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Stats"
        sub="Profit uses FIFO cost: the oldest stock is counted as sold first."
        actions={
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  range === r.id ? "bg-accent-soft text-accent" : "text-ink-soft hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      <StaleNote stale={stale} />
      {error && !data && <Empty>{error}</Empty>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue" value={rs(s?.revenue)} sub={`${s?.salesCount ?? 0} sales · ${s?.voidedCount ?? 0} voided`} />
        <Stat label="Cash" value={rs(s?.cash)} />
        <Stat label="Online" value={rs(s?.online)} />
        <Stat label="Gross profit" value={rs(s?.grossProfit)} sub="Revenue − cost of goods" />
        <Stat label="Net profit" value={rs(s?.netProfit)} sub={`After write-offs and ${rs(s?.costs)} costs`} />
        <Stat label="Cost of goods sold" value={rs(s?.cogs)} />
        <Stat label="Write-offs" value={rs(s?.writeOffs)} sub="Waste, expiry, shrinkage" />
        <Stat label="Stock value" value={rs(data?.stockValue)} sub="On the shelf now, at cost" />
      </div>

      {data && range !== "today" && data.daily.length > 0 && (
        <Card className="mt-4 p-4">
          <ChartHead title="Daily revenue and profit" legend={[["bg-accent", "Revenue"], ["bg-ink-soft", "Profit"]]} />
          <DailyBars daily={data.daily} />
        </Card>
      )}

      {data && (
        <Card className="mt-4 p-4">
          <ChartHead title="Sales by hour" legend={[["bg-accent", "Revenue"]]} />
          <HourlyBars hourly={data.hourly} />
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Top items</h2>
          {data && !data.topItems.length ? (
            <p className="text-sm text-ink-faint">No sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Sold</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                  <th className="pb-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data?.topItems.map((i) => (
                  <tr key={i.itemId} className="border-t border-line">
                    <td className="py-1.5">{i.name}</td>
                    <td className="py-1.5 text-right">{i.qty}</td>
                    <td className="py-1.5 text-right">{rs(i.revenue)}</td>
                    <td className="py-1.5 text-right">{rs(i.revenue - i.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">By cashier</h2>
            {data && !data.byCashier.length ? (
              <p className="text-sm text-ink-faint">No sales yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-faint">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 text-right font-medium">Sales</th>
                    <th className="pb-2 text-right font-medium">Cash</th>
                    <th className="pb-2 text-right font-medium">Online</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data?.byCashier.map((c) => (
                    <tr key={c.userId} className="border-t border-line">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-right">{c.count}</td>
                      <td className="py-1.5 text-right">{rs(c.cash)}</td>
                      <td className="py-1.5 text-right">{rs(c.online)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Low stock</h2>
            {data && !data.lowStock.length ? (
              <p className="text-sm text-ink-faint">Everything is above its low-stock level.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data?.lowStock.map((i) => (
                  <li key={i.id} className="flex items-center justify-between">
                    <span>{i.name}</span>
                    <Badge tone={i.stock <= 0 ? "bad" : "warn"}>
                      {i.stock <= 0 ? (i.stock < 0 ? `${-i.stock} oversold` : "Out") : `${i.stock} left`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChartHead({ title, legend }: { title: string; legend: [string, string][] }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex gap-3 text-xs text-ink-soft">
        {legend.map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cx("size-2.5 rounded-sm", cls)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DailyBars({ daily }: { daily: Stats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenue));
  const showEvery = daily.length > 14 ? Math.ceil(daily.length / 10) : 1;
  return (
    <div>
      <div className="flex h-40 items-end gap-0.5 sm:gap-1">
        {daily.map((d) => (
          <div
            key={d.day}
            className="group flex h-full flex-1 items-end gap-px"
            title={`${fmtDate(d.day)}: ${rs(d.revenue)} revenue, ${rs(d.profit)} profit`}
          >
            <div className="flex-1 rounded-t-sm bg-accent" style={{ height: `${(d.revenue / max) * 100}%` }} />
            <div
              className="flex-1 rounded-t-sm bg-ink-soft"
              style={{ height: `${(Math.max(d.profit, 0) / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 sm:gap-1">
        {daily.map((d, i) => (
          <div key={d.day} className="flex-1 truncate text-center text-[10px] text-ink-faint">
            {i % showEvery === 0 ? d.day.slice(8) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function HourlyBars({ hourly }: { hourly: Stats["hourly"] }) {
  // Show the shop's working hours (or wherever sales happened).
  const active = hourly.filter((h) => h.count > 0).map((h) => h.hour);
  const from = Math.min(8, ...active);
  const to = Math.max(20, ...active);
  const hours = hourly.filter((h) => h.hour >= from && h.hour <= to);
  const max = Math.max(1, ...hours.map((h) => h.revenue));
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {hours.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 items-end" title={`${h.hour}:00 — ${rs(h.revenue)}, ${h.count} sales`}>
            <div className="w-full rounded-t-sm bg-accent" style={{ height: `${(h.revenue / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {hours.map((h) => (
          <div key={h.hour} className="flex-1 text-center text-[10px] text-ink-faint">
            {h.hour % 2 === 0 ? `${h.hour % 12 || 12}${h.hour < 12 ? "a" : "p"}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
