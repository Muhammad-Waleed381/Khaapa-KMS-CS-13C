"use client";

import { useState } from "react";
import { BarList, Meter, SplitBar } from "@/components/charts";
import { Icon } from "@/components/icons";
import { EmptyState, Explainer, KpiRow, KpiTile, Section } from "@/components/kit";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs, toPaisa, toRupees } from "@/lib/money";
import { fmtDate, fmtDateTime, pkDate } from "@/lib/time";
import { plural, ProofModal, rsRound, STATUS_WORDS, useProof, type Account, type Purchase } from "../shared";

// ---------------------------------------------------------------- types

export type Holder = {
  id: string;
  name: string;
  contact: string | null;
  shares: number;
  pricePerShare: number;
  boughtOn: string;
  note: string | null;
  fromRequest: boolean;
  ownership: number;
  invested: number;
  profitShare: number;
  payout: number;
  returnPct: number | null;
};

export type SharesSummary = {
  summary: { revenue: number; cash: number; online: number; cogs: number; writeOffs: number; costs: number; netProfit: number };
  stockValue: number;
  totalShares: number;
  totalInvestment: number;
  profitPerShare: number;
  shareholders: Holder[];
};

export type Period = { kind: "all" | "month" | "custom"; from: string; to: string };

export function periodQuery(p: Period) {
  if (p.kind === "all") return "";
  const q = new URLSearchParams();
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  return `?${q}`;
}

export function periodLabel(p: Period) {
  if (p.kind === "all") return "All time";
  if (p.from && p.to) return `${fmtDate(p.from)} – ${fmtDate(p.to)}`;
  return "This period";
}

type ShareSettings = { pricePerShare: number; maxPerPerson: number; totalOnOffer: number | null; open: boolean; accountId: string | null };
type SettingsResponse = { settings: ShareSettings; account: Account | null; accounts: (Account & { active: boolean })[]; requested: number };
type AdminPurchase = Purchase & { userId: string; name: string; email: string; accountLabel: string | null };

// ---------------------------------------------------------------- requests

/** Requests waiting for a decision come first: it's the thing to act on. */
export function ReviewRequests({ onDecided }: { onDecided: () => void }) {
  const reqs = useApi<{ purchases: AdminPurchase[] }>("/api/share-purchases?all=1");
  const [proofOf, setProofOf] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminPurchase | null>(null);
  const [showDecided, setShowDecided] = useState(false);
  const list = reqs.data?.purchases ?? [];
  const pending = list.filter((p) => p.status === "pending");
  const decided = list.filter((p) => p.status !== "pending");

  const decide = async (p: AdminPurchase, status: "approved" | "rejected", note?: string) => {
    if (status === "approved" && !confirm(`Did ${rs(p.total)} from ${p.name} arrive in the account? Approving adds ${plural(p.shares, "share")}.`))
      return;
    try {
      await api(`/api/share-purchases/${p.id}/decide`, { body: { status, note: note || null } });
      toast(status === "approved" ? `${p.name} now owns ${plural(p.shares, "more share")}` : "Request turned down");
      setRejecting(null);
      reqs.reload();
      onDecided();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <Section
      title={
        <span className="inline-flex items-center gap-2">
          Requests to review {pending.length > 0 && <Badge tone="warn">{pending.length} waiting</Badge>}
        </span>
      }
      description="Check the money arrived in the account, then approve. Approving adds the shares at the price they requested."
      action={
        decided.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowDecided(!showDecided)}>
            {showDecided ? "Hide past requests" : `Past requests (${decided.length})`}
          </Button>
        )
      }
    >
      {!reqs.data ? (
        <div className="grid place-items-center py-8">{reqs.error ? <EmptyState title={reqs.error} /> : <Spinner />}</div>
      ) : pending.length === 0 ? (
        <EmptyState title="Nothing to review" description="New share requests will show up here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pending.map((p) => (
            <RequestCard
              key={p.id}
              p={p}
              onView={() => setProofOf(p.id)}
              onApprove={() => decide(p, "approved")}
              onReject={() => setRejecting(p)}
            />
          ))}
        </div>
      )}

      {showDecided && decided.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {decided.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {p.name} · {plural(p.shares, "share")} · {rs(p.total)}
                </div>
                <div className="text-xs text-ink-faint">
                  {fmtDateTime(p.createdAt)}
                  {p.note && ` · ${p.note}`}
                </div>
              </div>
              <Badge tone={p.status === "approved" ? "good" : p.status === "rejected" ? "bad" : "neutral"}>{STATUS_WORDS[p.status]}</Badge>
              {p.hasProof && (
                <Button size="sm" variant="ghost" onClick={() => setProofOf(p.id)}>
                  Screenshot
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ProofModal id={proofOf} onClose={() => setProofOf(null)} />
      <RejectModal p={rejecting} onClose={() => setRejecting(null)} onReject={(note) => rejecting && decide(rejecting, "rejected", note)} />
    </Section>
  );
}

function RequestCard({ p, onView, onApprove, onReject }: { p: AdminPurchase; onView: () => void; onApprove: () => void; onReject: () => void }) {
  const proof = useProof(p.hasProof ? p.id : null);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onView}
          disabled={!p.hasProof}
          className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-muted text-xs text-ink-faint"
          aria-label="Open payment screenshot"
        >
          {proof?.proof ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proof.proof} alt="" className="size-full object-cover" />
          ) : p.hasProof ? (
            <Spinner />
          ) : (
            "No screenshot"
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{p.name}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{rs(p.total)}</div>
          <div className="text-sm text-ink-soft">
            {plural(p.shares, "share")} × {rs(p.pricePerShare)}
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            {fmtDateTime(p.createdAt)}
            {p.accountLabel && ` · to ${p.accountLabel}`}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="danger" className="flex-1" onClick={onReject}>
          Turn down
        </Button>
        <Button variant="primary" className="flex-1" onClick={onApprove}>
          <Icon name="check" /> Approve
        </Button>
      </div>
    </div>
  );
}

function RejectModal({ p, onClose, onReject }: { p: AdminPurchase | null; onClose: () => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal open={!!p} onClose={onClose} title={p ? `Turn down ${p.name}'s request?` : ""}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onReject(note.trim());
          setNote("");
        }}
      >
        <Field label="Reason" hint="They'll see this.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The payment didn't arrive" autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Keep it
          </Button>
          <Button type="submit" variant="danger">
            Turn down
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- settings

export function SaleSettings({ onSaved }: { onSaved: () => void }) {
  const st = useApi<SettingsResponse>("/api/shares/settings");
  return (
    <Section
      title="Share sale"
      description="Set the price and limits for new requests. A new price never changes shares already bought."
    >
      {!st.data ? (
        <div className="grid place-items-center py-8">{st.error ? <EmptyState title={st.error} /> : <Spinner />}</div>
      ) : (
        <SaleSettingsForm
          key={JSON.stringify(st.data.settings)}
          data={st.data}
          onSaved={() => {
            st.reload();
            onSaved();
          }}
        />
      )}
    </Section>
  );
}

function SaleSettingsForm({ data, onSaved }: { data: SettingsResponse; onSaved: () => void }) {
  const s = data.settings;
  const [price, setPrice] = useState(String(toRupees(s.pricePerShare)));
  const [cap, setCap] = useState(String(s.maxPerPerson));
  const [total, setTotal] = useState(s.totalOnOffer === null ? "" : String(s.totalOnOffer));
  const [open, setOpen] = useState(s.open);
  const [accountId, setAccountId] = useState(s.accountId ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/shares/settings", {
        body: {
          pricePerShare: toPaisa(Number(price)),
          maxPerPerson: Number(cap),
          totalOnOffer: total.trim() === "" ? null : Number(total),
          open,
          accountId: accountId || null,
        },
      });
      toast("Saved");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
        <span>
          <span className="block font-medium">{open ? "Shares are on sale" : "Shares are not on sale"}</span>
          <span className="text-sm text-ink-soft">{open ? "Approved members can send requests." : "Nobody can request shares."}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cx(
            "relative h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
            open ? "bg-primary" : "bg-line",
          )}
        >
          <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition", open ? "left-5" : "left-0.5")} />
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price per share (Rs)">
          <Input type="number" min={1} step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Most one person can own">
          <Input type="number" min={1} step={1} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} required />
        </Field>
        <Field label="Shares on offer" hint="Empty = no limit">
          <Input type="number" min={0} step={1} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
        </Field>
      </div>

      <Field label="Buyers pay into" hint={data.accounts.length ? undefined : "Add a payment account in Settings first."}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Choose an account…</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} — {a.provider} · {a.accountNumber}
            </option>
          ))}
        </Select>
      </Field>

      {s.totalOnOffer !== null && (
        <Meter value={data.requested} max={s.totalOnOffer} label="Requested or sold so far" format={(v) => v.toLocaleString()} />
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- owners

/** One person can hold several purchases; the charts show people. */
function byPerson(holders: Holder[]) {
  const map = new Map<string, { name: string; shares: number; invested: number; payout: number; profit: number }>();
  for (const h of holders) {
    const k = h.name.trim().toLowerCase();
    const cur = map.get(k) ?? { name: h.name, shares: 0, invested: 0, payout: 0, profit: 0 };
    cur.shares += h.shares;
    cur.invested += h.invested;
    cur.payout += h.payout;
    cur.profit += h.profitShare;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.shares - a.shares || b.invested - a.invested);
}

export function Owners({
  d,
  period,
  onEdit,
  onAdd,
}: {
  d: SharesSummary;
  period: Period;
  onEdit: (h: Holder) => void;
  onAdd: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const people = byPerson(d.shareholders);
  const top = people.slice(0, 3);
  const rest = people.slice(3);
  const parts = [
    ...top.map((p) => ({ label: p.name, value: p.shares })),
    ...(rest.length ? [{ label: `${plural(rest.length, "other")}`, value: rest.reduce((s, p) => s + p.shares, 0), color: "var(--series-muted)" }] : []),
  ];

  return (
    <Section
      title="Who owns Khaapa"
      description={`Each share gets an equal part of the profit: ${rsRound(d.profitPerShare)} per share (${periodLabel(period).toLowerCase()}).`}
      action={
        <div className="flex gap-2">
          {people.length > 0 && (
            <Button size="sm" onClick={() => shareText(statement(d, period))}>
              <Icon name="share" /> Share statement
            </Button>
          )}
          <Button size="sm" onClick={onAdd}>
            <Icon name="plus" /> Add by hand
          </Button>
        </div>
      }
    >
      {people.length === 0 ? (
        <EmptyState title="No shareholders yet" description="Approved share requests appear here automatically." />
      ) : (
        <>
          <KpiRow>
            <KpiTile label="Shares" value={d.totalShares.toLocaleString()} hint={plural(people.length, "owner")} />
            <KpiTile label="Money put in" value={rs(d.totalInvestment)} />
            <KpiTile label="Profit per share" value={rsRound(d.profitPerShare)} hint={periodLabel(period)} />
            <KpiTile label="Stock on the shelf" value={rsRound(d.stockValue)} hint="At what we paid" />
          </KpiRow>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
              <div className="text-sm font-medium">Shares owned</div>
              <SplitBar parts={parts} format={(v) => plural(v, "share")} height={18} />
            </div>
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
              <div className="text-sm font-medium">What each person would get back</div>
              <BarList
                rows={people.map((p) => ({ label: p.name, value: p.payout, hint: `${rs(p.invested)} put in + ${rsRound(p.profit)} profit` }))}
                format={rsRound}
                max={5}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              aria-expanded={showAll}
            >
              Every holding ({d.shareholders.length})
              <span className="text-ink-faint">{showAll ? "Hide" : "Show"}</span>
            </button>
            {showAll && (
              <ul className="divide-y divide-line border-t border-line">
                {d.shareholders.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {h.name} {h.fromRequest && <Badge tone="accent">Bought online</Badge>}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {plural(h.shares, "share")} at {rs(h.pricePerShare)} · since {fmtDate(h.boughtOn)}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="font-medium">{rsRound(h.payout)}</div>
                      <div className="text-xs text-ink-faint">gets back</div>
                    </div>
                    <button
                      onClick={() => onEdit(h)}
                      className="rounded-md p-1.5 text-ink-faint hover:bg-muted hover:text-ink"
                      aria-label={`Edit ${h.name}`}
                    >
                      <Icon name="edit" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- profit

/** Sales, then each deduction stepping down from it, ending at net profit. */
export function ProfitPicture({ d, period, onPeriod }: { d: SharesSummary; period: Period; onPeriod: (p: Period) => void }) {
  const s = d.summary;
  const steps = [
    { label: "Sales", value: s.revenue, kind: "total" as const },
    { label: "Cost of the stock sold", value: -s.cogs, kind: "minus" as const },
    { label: "Stock thrown away", value: -s.writeOffs, kind: "minus" as const },
    { label: "Running costs", value: -s.costs, kind: "minus" as const },
    { label: "Net profit", value: s.netProfit, kind: "total" as const },
  ];
  const scale = Math.max(1, s.revenue, Math.abs(s.netProfit));
  let running = s.revenue;
  return (
    <Section
      title="How the profit adds up"
      description="Money from sales, minus what the stock cost us, what went to waste and running costs. Stock cost counts the oldest stock first."
      action={<PeriodPicker period={period} onChange={onPeriod} />}
    >
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        {steps.map((st) => {
          let left = 0;
          let width = 0;
          if (st.kind === "total") {
            width = Math.abs(st.value) / scale;
          } else {
            const after = running + st.value;
            left = Math.max(0, after) / scale;
            width = Math.abs(st.value) / scale;
            running = after;
          }
          return (
            <div key={st.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr_7rem]">
              <div className={cx("text-sm", st.kind === "total" ? "font-semibold text-ink" : "text-ink-soft")}>
                {st.kind === "minus" && "− "}
                {st.label}
              </div>
              <div className="relative h-5 rounded-full bg-muted/50">
                <div
                  className="absolute inset-y-0 rounded-[4px]"
                  style={{
                    left: `${left * 100}%`,
                    width: `${Math.max(width * 100, st.value ? 0.5 : 0)}%`,
                    background: st.kind === "total" ? "var(--series-1)" : "var(--series-muted)",
                  }}
                  title={`${st.label}: ${rsRound(st.value)}`}
                />
              </div>
              <div className={cx("col-span-2 text-right text-sm tabular-nums sm:col-span-1", st.kind === "total" && "font-semibold")}>
                {rsRound(st.value)}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const pick = (kind: Period["kind"]) => {
    const today = pkDate();
    if (kind === "all") onChange({ kind, from: "", to: "" });
    else if (kind === "month") onChange({ kind, from: `${today.slice(0, 8)}01`, to: today });
    else onChange({ kind, from: period.from || `${today.slice(0, 8)}01`, to: period.to || today });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {(
          [
            ["all", "All time"],
            ["month", "This month"],
            ["custom", "Pick dates"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            onClick={() => pick(kind)}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              period.kind === kind ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {period.kind === "custom" && (
        <div className="flex gap-2">
          <Input type="date" aria-label="From" value={period.from} onChange={(e) => onChange({ ...period, from: e.target.value })} className="w-auto" />
          <Input type="date" aria-label="To" value={period.to} onChange={(e) => onChange({ ...period, to: e.target.value })} className="w-auto" />
        </div>
      )}
    </div>
  );
}

function statement(d: SharesSummary, period: Period) {
  return [
    `Khaapa payout statement (${periodLabel(period)})`,
    ``,
    `Sales: ${rs(d.summary.revenue)}`,
    `Cost of stock sold: ${rs(d.summary.cogs)}`,
    `Stock thrown away: ${rs(d.summary.writeOffs)}`,
    `Running costs: ${rs(d.summary.costs)}`,
    `Net profit: ${rs(d.summary.netProfit)}`,
    `Profit per share: ${rs(d.profitPerShare)} (${d.totalShares} shares)`,
    ``,
    ...byPerson(d.shareholders).map(
      (p) => `${p.name}: ${plural(p.shares, "share")}, put in ${rs(p.invested)}, profit ${rs(p.profit)}, gets back ${rs(p.payout)}`,
    ),
  ].join("\n");
}

async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // Cancelled or unsupported: copy instead.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Statement copied");
  } catch {
    toast("Couldn't copy", "bad");
  }
}

// ---------------------------------------------------------------- costs

type Cost = { id: string; date: string; amount: number; note: string };

export function CostsLedger({ period, onChanged }: { period: Period; onChanged: () => void }) {
  const costs = useApi<{ costs: Cost[] }>(`/api/costs${periodQuery(period)}`);
  const [adding, setAdding] = useState(false);
  const list = costs.data?.costs ?? [];
  const total = list.reduce((s, c) => s + c.amount, 0);

  const remove = async (c: Cost) => {
    if (!confirm(`Delete "${c.note}" (${rs(c.amount)})? Net profit will change.`)) return;
    try {
      await api(`/api/costs/${c.id}`, { method: "DELETE" });
      toast("Deleted");
      costs.reload();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Rickshaw fares, bags, fees… anything that reduces profit.</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add cost
        </Button>
      </div>
      {!costs.data ? (
        costs.error ? <EmptyState title={costs.error} /> : <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="No costs in this period" />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.note}</div>
                <div className="text-xs text-ink-faint">{fmtDate(c.date)}</div>
              </div>
              <div className="text-sm font-medium tabular-nums">{rs(c.amount)}</div>
              <button onClick={() => remove(c)} className="rounded-md p-1.5 text-ink-faint hover:bg-muted hover:text-destructive" aria-label="Delete cost">
                <Icon name="trash" />
              </button>
            </li>
          ))}
          <li className="flex justify-between px-4 py-2.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{rs(total)}</span>
          </li>
        </ul>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a cost">
        {adding && (
          <CostForm
            onSaved={() => {
              setAdding(false);
              costs.reload();
              onChanged();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CostForm({ onSaved }: { onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = n > 0 && note.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await api("/api/costs", { body: { amount: toPaisa(n), note: note.trim(), date: date || pkDate() } });
      toast("Cost added");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "bad");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="What was it for?">
        <Input placeholder="e.g. Rickshaw to Metro" value={note} onChange={(e) => setNote(e.target.value)} autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (Rs)">
          <Input type="number" min={0} step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Date" hint="Empty = today">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!valid || busy}>
          {busy ? "Saving…" : "Add cost"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- holders added by hand

export function HolderModal({ holder, onClose, onSaved }: { holder: Holder | "new" | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={!!holder} onClose={onClose} title={holder === "new" ? "Add a shareholder by hand" : "Edit holding"}>
      {holder && <HolderForm key={holder === "new" ? "new" : holder.id} holder={holder} onSaved={onSaved} />}
    </Modal>
  );
}

function HolderForm({ holder, onSaved }: { holder: Holder | "new"; onSaved: () => void }) {
  const h = holder === "new" ? null : holder;
  const [name, setName] = useState(h?.name ?? "");
  const [contact, setContact] = useState(h?.contact ?? "");
  const [shares, setShares] = useState(h ? String(h.shares) : "");
  const [price, setPrice] = useState(h ? String(toRupees(h.pricePerShare)) : "");
  const [boughtOn, setBoughtOn] = useState(h?.boughtOn ?? "");
  const [note, setNote] = useState(h?.note ?? "");
  const [busy, setBusy] = useState(false);
  const nShares = Number(shares);
  const nPrice = Number(price);
  const valid = name.trim() && Number.isInteger(nShares) && nShares > 0 && price !== "" && nPrice >= 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        contact: contact.trim() || null,
        shares: nShares,
        pricePerShare: toPaisa(nPrice),
        boughtOn: boughtOn || pkDate(),
        note: note.trim() || null,
      };
      if (h) await api(`/api/shareholders/${h.id}`, { method: "PATCH", body });
      else await api("/api/shareholders", { body });
      toast(h ? "Saved" : "Shareholder added");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!h || !confirm(`Remove this holding of ${h.name}? Their shares stop counting in the split.`)) return;
    setBusy(true);
    try {
      await api(`/api/shareholders/${h.id}`, { method: "DELETE" });
      toast("Removed");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "bad");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {!h && <Explainer>Use this only for shares bought outside the app, e.g. the founders&apos; shares.</Explainer>}
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shares">
          <Input type="number" min={1} step={1} inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} required />
        </Field>
        <Field label="Price per share (Rs)">
          <Input type="number" min={0} step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
      </div>
      {valid && (
        <p className="text-sm text-ink-soft">
          Put in: <b className="text-ink">{rs(nShares * toPaisa(nPrice))}</b>
        </p>
      )}
      <Field label="Bought on" hint="Empty = today">
        <Input type="date" value={boughtOn} onChange={(e) => setBoughtOn(e.target.value)} />
      </Field>
      <Field label="Contact" hint="Optional">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
      </Field>
      <Field label="Note" hint="Optional">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-2">
        {h ? (
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>
            <Icon name="trash" /> Remove
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" disabled={!valid || busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
