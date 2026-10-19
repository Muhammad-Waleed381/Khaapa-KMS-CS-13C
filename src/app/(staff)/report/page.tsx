"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Button, Card, Empty, Input, PageHeader, StaleNote, Stat } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { addDays, fmtDate, pkDate, pkTime } from "@/lib/time";

type Report = {
  date: string;
  totals: { total: number; cash: number; online: number; count: number; voids: number; cogs: number; grossProfit: number };
  expectedCash: number;
  itemsSold: { itemId: string; name: string; qty: number; revenue: number; cost: number; profit: number }[];
  oversold: { saleId: string; name: string; qty: number; at: string }[];
  writeOffs: { name: string; kind: string; qty: number; cost: number; note: string | null; by: string | null }[];
  writeOffTotal: number;
  restocks: { name: string; qty: number; cost: number; supplier: string | null; by: string | null }[];
  restockTotal: number;
  shifts: { name: string; startedAt: string; endedAt: string | null }[];
  preorders: { code: string; customerName: string; total: number }[];
};

/** Plain text for WhatsApp: short lines, no emoji, *bold* headings. */
function toText(r: Report) {
  const out = [
    `*Khaapa day report — ${fmtDate(r.date)}*`,
    "",
    `Sales: ${rs(r.totals.total)} (${r.totals.count} sales${r.totals.voids ? `, ${r.totals.voids} voided` : ""})`,
    `Cash: ${rs(r.totals.cash)}`,
    `Online: ${rs(r.totals.online)}`,
    `Cash expected in hand: ${rs(r.expectedCash)}`,
    `Gross profit: ${rs(r.totals.grossProfit)} (cost ${rs(r.totals.cogs)})`,
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
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDate(pkDate()), []);
  const { data: r, error, stale } = useApi<Report>(date ? `/api/report?date=${date}` : null);

  async function share() {
    if (!r) return;
    const text = toText(r);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Day report"
        sub="For the team only. Share it at closing time."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => date && setDate(addDays(date, -1))} aria-label="Previous day">
                ‹
              </Button>
              <Input
                type="date"
                className="w-40"
                value={date ?? ""}
                max={pkDate()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <Button
                size="sm"
                disabled={date === pkDate()}
                onClick={() => date && setDate(addDays(date, 1))}
                aria-label="Next day"
              >
                ›
              </Button>
            </div>
            <Button onClick={copy} disabled={!r}>
              <Icon name="copy" /> Copy
            </Button>
            <Button variant="primary" onClick={share} disabled={!r}>
              <Icon name="share" /> Share
            </Button>
          </>
        }
      />
      <StaleNote stale={stale} />
      {error && !r && <Empty>{error}</Empty>}

      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sales" value={rs(r.totals.total)} sub={`${r.totals.count} sales${r.totals.voids ? ` · ${r.totals.voids} voided` : ""}`} />
            <Stat label="Cash in hand (expected)" value={rs(r.expectedCash)} />
            <Stat label="Online" value={rs(r.totals.online)} />
            <Stat label="Gross profit" value={rs(r.totals.grossProfit)} sub={`Cost ${rs(r.totals.cogs)}`} />
          </div>

          <Section title="Items sold" empty="Nothing sold." show={r.itemsSold.length > 0}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                  <th className="hidden pb-2 text-right font-medium sm:table-cell">Cost</th>
                  <th className="pb-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {r.itemsSold.map((i) => (
                  <tr key={i.itemId} className="border-t border-line">
                    <td className="py-1.5">{i.name}</td>
                    <td className="py-1.5 text-right">{i.qty}</td>
                    <td className="py-1.5 text-right">{rs(i.revenue)}</td>
                    <td className="hidden py-1.5 text-right sm:table-cell">{rs(i.cost)}</td>
                    <td className="py-1.5 text-right">{rs(i.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {r.oversold.length > 0 && (
            <Section title="Sold while out of stock" show>
              <p className="mb-2 text-xs text-ink-faint">Their cost is counted when the next restock arrives.</p>
              <Rows rows={r.oversold.map((o) => [`${o.qty}× ${o.name}`, pkTime(o.at)])} />
            </Section>
          )}

          <Section title={`Restocked · ${rs(r.restockTotal)}`} empty="No restocks." show={r.restocks.length > 0}>
            <Rows
              rows={r.restocks.map((x) => [
                `${x.qty}× ${x.name}${x.supplier ? ` from ${x.supplier}` : ""}${x.by ? ` · ${x.by}` : ""}`,
                rs(x.cost),
              ])}
            />
          </Section>

          <Section title={`Written off · ${rs(r.writeOffTotal)}`} empty="Nothing written off." show={r.writeOffs.length > 0}>
            <Rows
              rows={r.writeOffs.map((w) => [
                `${w.qty}× ${w.name}${w.kind === "correction" ? " (count correction)" : ""}${w.note ? ` — ${w.note}` : ""}`,
                rs(w.cost),
              ])}
            />
          </Section>

          {r.preorders.length > 0 && (
            <Section title="Pre-orders collected" show>
              <Rows rows={r.preorders.map((p) => [`${p.code} · ${p.customerName}`, rs(p.total)])} />
            </Section>
          )}

          <Section title="On the counter" empty="No shifts." show={r.shifts.length > 0}>
            <Rows
              rows={r.shifts.map((s) => [s.name, `${pkTime(s.startedAt)}–${s.endedAt ? pkTime(s.endedAt) : "still on"}`])}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, empty, show, children }: { title: string; empty?: string; show: boolean; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {show ? children : <p className="text-sm text-ink-faint">{empty}</p>}
    </Card>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map(([a, b], i) => (
        <li key={i} className="flex justify-between gap-4 py-1.5">
          <span>{a}</span>
          <span className="shrink-0 tabular-nums text-ink-soft">{b}</span>
        </li>
      ))}
    </ul>
  );
}
