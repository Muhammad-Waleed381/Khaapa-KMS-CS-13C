"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { compressImage } from "@/components/public/compress";
import {
  Badge,
  Button,
  Card,
  cx,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StaleNote,
  Stat,
  Textarea,
} from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { rs, toPaisa, toRupees } from "@/lib/money";
import { fmtDate, fmtDateTime, pkDate } from "@/lib/time";

type Holder = {
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

type SharesSummary = {
  period: { from: string | null; to: string | null };
  summary: { revenue: number; cash: number; online: number; cogs: number; writeOffs: number; costs: number; netProfit: number };
  stockValue: number;
  totalShares: number;
  totalInvestment: number;
  profitPerShare: number;
  netWorth: { investment: number; netProfit: number; total: number };
  shareholders: Holder[];
};

type Cost = { id: string; date: string; amount: number; note: string };

type Period = { kind: "all" | "month" | "custom"; from: string; to: string };

const pct = (n: number) => `${(n * 100).toLocaleString("en-PK", { maximumFractionDigits: 1 })}%`;

function query(p: Period) {
  if (p.kind === "all") return "";
  const q = new URLSearchParams();
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  return `?${q}`;
}

function periodLabel(p: Period) {
  if (p.kind === "all") return "All time";
  if (p.from && p.to) return `${fmtDate(p.from)} – ${fmtDate(p.to)}`;
  if (p.from) return `Since ${fmtDate(p.from)}`;
  if (p.to) return `Until ${fmtDate(p.to)}`;
  return "All time";
}

export default function SharesPage() {
  const { isAdmin } = useMe();
  const mine = useApi<Mine>("/api/shares/mine");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Shares"
        sub={isAdmin ? "Who owns Khaapa, share sales, and what each shareholder gets back." : "Your shares in Khaapa, and buying more."}
      />
      <StaleNote stale={mine.stale} />
      <MyShares mine={mine.data} error={mine.error} reload={mine.reload} />
      {isAdmin && <AdminShares onChanged={mine.reload} />}
    </div>
  );
}

// ---------------------------------------------------------------- everyone

type Account = { id: string; label: string; provider: string; accountTitle: string; accountNumber: string };

type Purchase = {
  id: string;
  shares: number;
  pricePerShare: number;
  total: number;
  paymentRef: string | null;
  hasProof: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  createdAt: string;
};

type Mine = {
  holdings: { id: string; shares: number; pricePerShare: number; boughtOn: string; fromRequest: boolean }[];
  totals: { shares: number; invested: number; estimatedProfit: number; payout: number };
  totalShares: number;
  profitPerShare: number;
  purchases: Purchase[];
  offer: { open: boolean; pricePerShare: number; maxPerPerson: number; remaining: number; account: Account | null };
};

const STATUS_TONE = { pending: "warn", approved: "good", rejected: "bad", cancelled: "neutral" } as const;
const STATUS_LABEL = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };

function MyShares({ mine, error, reload }: { mine: Mine | undefined; error: string | null; reload: () => void }) {
  const [proofOf, setProofOf] = useState<string | null>(null);
  if (!mine) return <div className="grid place-items-center py-10">{error ? <Empty>{error}</Empty> : <Spinner />}</div>;

  const cancel = async (p: Purchase) => {
    if (!confirm(`Cancel your request for ${p.shares} share${p.shares > 1 ? "s" : ""}?`)) return;
    try {
      await api(`/api/share-purchases/${p.id}/cancel`, { method: "POST" });
      toast("Request cancelled");
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">My shares</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Shares I own" value={mine.totals.shares} sub={`of ${mine.totalShares.toLocaleString()} in total`} />
        <Stat label="I invested" value={rs(mine.totals.invested)} />
        <Stat
          label="My profit so far"
          value={<span className={mine.totals.estimatedProfit < 0 ? "text-destructive" : ""}>{rs(mine.totals.estimatedProfit)}</span>}
          sub={mine.totals.shares ? `${rs(mine.profitPerShare)} per share, all time` : "Buy shares to earn a part of the profit"}
        />
        <Stat label="I'd receive" value={rs(mine.totals.payout)} sub="Investment + profit, if paid out today" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <BuyShares offer={mine.offer} onDone={reload} />
        <Card className="p-4">
          <h3 className="text-sm font-semibold">My holdings</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Each purchase keeps the price it was bought at.</p>
          {mine.holdings.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">You don&apos;t own any shares yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {mine.holdings.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    {h.shares} share{h.shares > 1 ? "s" : ""} at {rs(h.pricePerShare)}
                    <span className="block text-xs text-ink-faint">Since {fmtDate(h.boughtOn)}</span>
                  </span>
                  <span className="tabular-nums">{rs(h.shares * h.pricePerShare)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {mine.purchases.length > 0 && (
        <Card className="mt-4">
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">My requests</div>
          <ul>
            {mine.purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <div>
                    {p.shares} share{p.shares > 1 ? "s" : ""} at {rs(p.pricePerShare)} · <b>{rs(p.total)}</b>
                  </div>
                  <div className="text-xs text-ink-faint">
                    {fmtDateTime(p.createdAt)}
                    {p.paymentRef && ` · ref ${p.paymentRef}`}
                    {p.note && ` · ${p.note}`}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                {p.hasProof && (
                  <Button size="sm" variant="ghost" onClick={() => setProofOf(p.id)}>
                    Screenshot
                  </Button>
                )}
                {p.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(p)}>
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ProofModal id={proofOf} onClose={() => setProofOf(null)} />
    </section>
  );
}

function BuyShares({ offer, onDone }: { offer: Mine["offer"]; onDone: () => void }) {
  const [count, setCount] = useState(1);
  const [ref, setRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!offer.open)
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Buy shares</h3>
        <p className="mt-2 text-sm text-ink-soft">Shares aren&apos;t on sale right now. Admins will open them when there&apos;s a new round.</p>
      </Card>
    );
  if (offer.remaining <= 0)
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Buy shares</h3>
        <p className="mt-2 text-sm text-ink-soft">
          You&apos;ve reached the limit of {offer.maxPerPerson} share{offer.maxPerPerson > 1 ? "s" : ""} per person
          (counting requests still waiting for approval).
        </p>
      </Card>
    );

  const n = Math.min(Math.max(1, count), offer.remaining);
  const amount = n * offer.pricePerShare;
  const a = offer.account;

  const pickFile = async (file: File | undefined) => {
    if (!file) return setProof(null);
    try {
      setProof(await compressImage(file));
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/share-purchases", { body: { shares: n, paymentRef: ref.trim(), proof } });
      toast("Request sent. An admin will check your payment.");
      setRef("");
      setProof(null);
      setCount(1);
      onDone();
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Buy shares</h3>
      <p className="mt-0.5 text-xs text-ink-faint">
        {rs(offer.pricePerShare)} per share · you can buy {offer.remaining} more (limit {offer.maxPerPerson} per person)
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-md border border-line">
            <button type="button" className="px-3 py-1.5 text-ink-soft hover:text-ink disabled:opacity-40" onClick={() => setCount(n - 1)} disabled={n <= 1} aria-label="Fewer">
              <Icon name="minus" />
            </button>
            <span className="w-8 text-center font-semibold tabular-nums">{n}</span>
            <button type="button" className="px-3 py-1.5 text-ink-soft hover:text-ink disabled:opacity-40" onClick={() => setCount(n + 1)} disabled={n >= offer.remaining} aria-label="More">
              <Icon name="plus" />
            </button>
          </div>
          <div className="text-sm">
            share{n > 1 ? "s" : ""} · pay <b className="text-base tabular-nums">{rs(amount)}</b>
          </div>
        </div>

        {a ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="text-xs text-ink-faint">Send {rs(amount)} to</div>
            <div className="mt-1 font-medium">
              {a.provider} · {a.accountTitle}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono tabular-nums">{a.accountNumber}</span>
              <button
                type="button"
                className="rounded p-1 text-ink-faint hover:bg-background hover:text-ink"
                aria-label="Copy account number"
                onClick={() =>
                  navigator.clipboard.writeText(a.accountNumber).then(
                    () => toast("Account number copied"),
                    () => toast("Couldn't copy", "bad"),
                  )
                }
              >
                <Icon name="copy" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-destructive">No payment account is set yet. Ask an admin.</p>
        )}

        <Field label="Transaction ID" hint="From your payment app's receipt">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} required minLength={3} />
        </Field>
        <Field label="Payment screenshot" hint="Optional, but it speeds up approval">
          <Input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />
        </Field>
        {proof && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof} alt="Payment screenshot" className="max-h-40 rounded-md border border-line" />
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !a || ref.trim().length < 3}>
          {busy ? "Sending…" : `I've paid ${rs(amount)}, send request`}
        </Button>
      </form>
    </Card>
  );
}

function ProofModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const proof = useApi<{ proof: string | null; paymentRef: string | null }>(id ? `/api/share-purchases/${id}/proof` : null);
  return (
    <Modal open={!!id} onClose={onClose} title="Payment screenshot">
      {!proof.data ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {proof.data.paymentRef && <div className="text-sm">Transaction ID: <b>{proof.data.paymentRef}</b></div>}
          {proof.data.proof ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proof.data.proof} alt="Payment screenshot" className="w-full rounded-md border border-line" />
          ) : (
            <p className="text-sm text-ink-soft">No screenshot was attached.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- admins

type ShareSettings = { pricePerShare: number; maxPerPerson: number; totalOnOffer: number | null; open: boolean; accountId: string | null };

function ShareSettingsCard({ onSaved }: { onSaved: () => void }) {
  const st = useApi<{ settings: ShareSettings; accounts: (Account & { active: boolean })[] }>("/api/shares/settings");
  if (!st.data) return <Card className="p-4">{st.error ? <Empty>{st.error}</Empty> : <Spinner />}</Card>;
  return <ShareSettingsForm key={JSON.stringify(st.data.settings)} settings={st.data.settings} accounts={st.data.accounts} onSaved={() => { st.reload(); onSaved(); }} />;
}

function ShareSettingsForm({ settings, accounts, onSaved }: { settings: ShareSettings; accounts: Account[]; onSaved: () => void }) {
  const [price, setPrice] = useState(String(toRupees(settings.pricePerShare)));
  const [cap, setCap] = useState(String(settings.maxPerPerson));
  const [total, setTotal] = useState(settings.totalOnOffer === null ? "" : String(settings.totalOnOffer));
  const [open, setOpen] = useState(settings.open);
  const [accountId, setAccountId] = useState(settings.accountId ?? "");
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
      toast("Share settings saved");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Share sale settings</h3>
          <p className="mt-0.5 text-xs text-ink-faint">A new price only applies to new requests; earlier ones keep their price.</p>
        </div>
        <Badge tone={settings.open ? "good" : "neutral"}>{settings.open ? "On sale" : "Closed"}</Badge>
      </div>
      <form onSubmit={save} className="mt-3 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price per share (Rs)">
            <Input type="number" min={1} step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Max per person">
            <Input type="number" min={1} step={1} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} required />
          </Field>
          <Field label="Total on offer" hint="Empty = no limit">
            <Input type="number" min={0} step={1} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
        </div>
        <Field label="Buyers pay into" hint={accounts.length ? undefined : "Add a payment account in Settings first"}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Choose an account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.provider} · {a.accountTitle} · {a.accountNumber}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Shares are on sale (approved accounts can send requests)
        </label>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type AdminPurchase = Purchase & { userId: string; name: string; email: string; accountLabel: string | null; accountProvider: string | null };

function RequestsCard({ onDecided }: { onDecided: () => void }) {
  const reqs = useApi<{ purchases: AdminPurchase[] }>("/api/share-purchases?all=1");
  const [proofOf, setProofOf] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const list = reqs.data?.purchases ?? [];
  const pending = list.filter((p) => p.status === "pending");
  const shown = showAll ? list : pending;

  const decide = async (p: AdminPurchase, status: "approved" | "rejected") => {
    let note: string | null = null;
    if (status === "rejected") {
      note = prompt(`Why are you rejecting ${p.name}'s request? (shown to them)`);
      if (note === null) return;
    } else if (!confirm(`Approve ${p.shares} share${p.shares > 1 ? "s" : ""} for ${p.name} at ${rs(p.pricePerShare)} (${rs(p.total)})? Check the payment arrived first.`)) {
      return;
    }
    try {
      await api(`/api/share-purchases/${p.id}/decide`, { body: { status, note: note || null } });
      toast(status === "approved" ? `${p.name} is now a shareholder` : "Request rejected");
      reqs.reload();
      onDecided();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="text-sm font-semibold">
          Share requests {pending.length > 0 && <Badge tone="warn">{pending.length} waiting</Badge>}
        </div>
        {list.length > pending.length && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Waiting only" : "Show all"}
          </Button>
        )}
      </div>
      {!reqs.data ? (
        <div className="p-4">{reqs.error ? <Empty>{reqs.error}</Empty> : <Spinner />}</div>
      ) : shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-faint">{showAll ? "No requests yet." : "No requests waiting."}</p>
      ) : (
        <ul>
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 text-sm last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-ink-faint">
                  {p.shares} share{p.shares > 1 ? "s" : ""} at {rs(p.pricePerShare)} · <b className="text-ink">{rs(p.total)}</b>
                  {p.accountLabel && ` · to ${p.accountLabel}`}
                  {p.paymentRef && ` · ref ${p.paymentRef}`}
                </div>
                <div className="text-xs text-ink-faint">
                  {fmtDateTime(p.createdAt)}
                  {p.note && ` · ${p.note}`}
                </div>
              </div>
              {p.status !== "pending" && <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>}
              {p.hasProof && (
                <Button size="sm" variant="ghost" onClick={() => setProofOf(p.id)}>
                  Screenshot
                </Button>
              )}
              {p.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => decide(p, "rejected")}>
                    Reject
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => decide(p, "approved")}>
                    <Icon name="check" /> Approve
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ProofModal id={proofOf} onClose={() => setProofOf(null)} />
    </Card>
  );
}

function AdminShares({ onChanged }: { onChanged: () => void }) {
  const [period, setPeriod] = useState<Period>({ kind: "all", from: "", to: "" });
  const qs = query(period);
  const sum = useApi<SharesSummary>(`/api/shares/summary${qs}`);
  const costs = useApi<{ costs: Cost[] }>(`/api/costs${qs}`);
  const [editing, setEditing] = useState<Holder | "new" | null>(null);
  const [addingCost, setAddingCost] = useState(false);

  const reloadAll = () => {
    sum.reload();
    costs.reload();
  };

  const d = sum.data;

  return (
    <div className="mt-10 border-t border-line pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">All shareholders</h2>
          <p className="text-sm text-ink-soft">Admins only: share sales, the profit split and running costs.</p>
        </div>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Icon name="plus" /> Add shareholder
        </Button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ShareSettingsCard onSaved={onChanged} />
        <RequestsCard
          onDecided={() => {
            sum.reload();
            onChanged();
          }}
        />
      </div>

      <PeriodPicker period={period} onChange={setPeriod} />

      {!d ? (
        <div className="grid place-items-center py-16">
          {sum.error ? <Empty>{sum.error}</Empty> : <Spinner />}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Net profit"
              value={<span className={d.summary.netProfit < 0 ? "text-destructive" : ""}>{rs(d.summary.netProfit)}</span>}
              sub={periodLabel(period)}
            />
            <Stat
              label="Profit per share"
              value={d.totalShares ? rs(d.profitPerShare) : "—"}
              sub={`${d.totalShares.toLocaleString()} shares in total`}
            />
            <Stat label="Total investment" value={rs(d.totalInvestment)} sub={`${d.shareholders.length} holdings`} />
            <Stat label="Stock on the shelf" value={rs(d.stockValue)} sub="At what we paid for it" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Breakdown d={d} />
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Net worth</h2>
              <p className="mt-0.5 text-xs text-ink-faint">Money put in, plus profit made.</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Investment" value={rs(d.netWorth.investment)} />
                <Row label="Net profit" value={rs(d.netWorth.netProfit)} />
                <div className="border-t border-line pt-2">
                  <Row label="Net worth" value={rs(d.netWorth.total)} strong />
                </div>
                <div className="pt-2 text-xs text-ink-faint">
                  Collected: {rs(d.summary.cash)} cash · {rs(d.summary.online)} online
                </div>
              </dl>
            </Card>
          </div>

          <Shareholders d={d} period={period} onEdit={setEditing} />
        </>
      )}

      <Costs
        costs={costs.data?.costs}
        error={costs.error}
        onAdd={() => setAddingCost(true)}
        onDeleted={reloadAll}
      />

      <HolderModal
        holder={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          sum.reload();
          onChanged();
        }}
      />
      <CostModal
        open={addingCost}
        onClose={() => setAddingCost(false)}
        onSaved={() => {
          setAddingCost(false);
          reloadAll();
        }}
      />
    </div>
  );
}

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const tabs: { kind: Period["kind"]; label: string }[] = [
    { kind: "all", label: "All time" },
    { kind: "month", label: "This month" },
    { kind: "custom", label: "Custom" },
  ];
  const pick = (kind: Period["kind"]) => {
    const today = pkDate();
    if (kind === "all") onChange({ kind, from: "", to: "" });
    else if (kind === "month") onChange({ kind, from: `${today.slice(0, 8)}01`, to: today });
    else onChange({ kind, from: period.from || `${today.slice(0, 8)}01`, to: period.to || today });
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            onClick={() => pick(tab.kind)}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              period.kind === tab.kind ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {period.kind === "custom" && (
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label="From"
            value={period.from}
            onChange={(e) => onChange({ ...period, from: e.target.value })}
            className="w-auto"
          />
          <Input
            type="date"
            aria-label="To"
            value={period.to}
            onChange={(e) => onChange({ ...period, to: e.target.value })}
            className="w-auto"
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, minus }: { label: string; value: string; strong?: boolean; minus?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", strong && "font-semibold")}>
      <dt className={strong ? "" : "text-ink-soft"}>
        {minus && <span className="mr-1 text-ink-faint">−</span>}
        {label}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Breakdown({ d }: { d: SharesSummary }) {
  const s = d.summary;
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">How the profit adds up</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Sales" value={rs(s.revenue)} />
        <Row label="Cost of stock sold" value={rs(s.cogs)} minus />
        <Row label="Stock written off" value={rs(s.writeOffs)} minus />
        <Row label="Costs (logistics, fees)" value={rs(s.costs)} minus />
        <div className="border-t border-line pt-2">
          <Row label="Net profit" value={rs(s.netProfit)} strong />
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-faint">
        Cost of stock sold uses FIFO: the oldest stock is sold first, at the price we paid for it.
      </p>
    </Card>
  );
}

function statement(d: SharesSummary, period: Period) {
  const lines = [
    `Khaapa payout statement (${periodLabel(period)})`,
    ``,
    `Sales: ${rs(d.summary.revenue)}`,
    `Cost of stock sold: ${rs(d.summary.cogs)}`,
    `Stock written off: ${rs(d.summary.writeOffs)}`,
    `Costs: ${rs(d.summary.costs)}`,
    `Net profit: ${rs(d.summary.netProfit)}`,
    `Profit per share: ${rs(d.profitPerShare)} (${d.totalShares} shares)`,
    ``,
    ...d.shareholders.map(
      (h) =>
        `${h.name}: ${h.shares} shares — invested ${rs(h.invested)}, profit ${rs(h.profitShare)}, receives ${rs(h.payout)}`,
    ),
  ];
  return lines.join("\n");
}

async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // Cancelled or unsupported: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Statement copied");
  } catch {
    toast("Couldn't copy", "bad");
  }
}

function Shareholders({
  d,
  period,
  onEdit,
}: {
  d: SharesSummary;
  period: Period;
  onEdit: (h: Holder) => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Shareholders</h2>
        {d.shareholders.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => shareText(statement(d, period))}>
              <Icon name="share" /> Share statement
            </Button>
          </div>
        )}
      </div>
      {d.shareholders.length === 0 ? (
        <Empty>No shareholders yet. Add one to split the profit.</Empty>
      ) : (
        <>
          {/* Phones: cards */}
          <div className="space-y-2 md:hidden">
            {d.shareholders.map((h) => (
              <Card key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.name}</div>
                    <div className="text-xs text-ink-faint">
                      {h.shares} shares at {rs(h.pricePerShare)} · {pct(h.ownership)}
                      {h.fromRequest && " · bought online"}
                    </div>
                  </div>
                  <button onClick={() => onEdit(h)} className="rounded-md p-1.5 text-ink-faint hover:bg-muted hover:text-ink" aria-label={`Edit ${h.name}`}>
                    <Icon name="edit" />
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <Mini label="Invested" value={rs(h.invested)} />
                  <Mini label="Profit" value={rs(h.profitShare)} tone={h.profitShare < 0 ? "bad" : undefined} />
                  <Mini label="Receives" value={rs(h.payout)} strong />
                </dl>
              </Card>
            ))}
          </div>

          {/* Larger screens: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                  <th className="px-4 py-2.5 text-right font-medium">Owns</th>
                  <th className="px-4 py-2.5 text-right font-medium">Invested</th>
                  <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Receives</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {d.shareholders.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {h.name} {h.fromRequest && <Badge tone="accent">Bought online</Badge>}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {rs(h.pricePerShare)}/share · since {fmtDate(h.boughtOn)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{h.shares}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{pct(h.ownership)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rs(h.invested)}</td>
                    <td className={cx("px-4 py-2.5 text-right tabular-nums", h.profitShare < 0 && "text-destructive")}>
                      {rs(h.profitShare)}
                      {h.returnPct !== null && (
                        <div className="text-xs text-ink-faint">{pct(h.returnPct)} return</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{rs(h.payout)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <button onClick={() => onEdit(h)} className="rounded-md p-1.5 text-ink-faint hover:bg-muted hover:text-ink" aria-label={`Edit ${h.name}`}>
                        <Icon name="edit" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line text-sm font-semibold">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.totalShares}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">100%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rs(d.totalInvestment)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {rs(d.shareholders.reduce((s, h) => s + h.profitShare, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {rs(d.shareholders.reduce((s, h) => s + h.payout, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </section>
  );
}

function Mini({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "bad" }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={cx("tabular-nums", strong && "font-semibold", tone === "bad" && "text-destructive")}>{value}</dd>
    </div>
  );
}

function Costs({
  costs,
  error,
  onAdd,
  onDeleted,
}: {
  costs: Cost[] | undefined;
  error: string | null;
  onAdd: () => void;
  onDeleted: () => void;
}) {
  const remove = async (c: Cost) => {
    if (!confirm(`Delete "${c.note}" (${rs(c.amount)})? Net profit will change.`)) return;
    try {
      await api(`/api/costs/${c.id}`, { method: "DELETE" });
      toast("Deleted");
      onDeleted();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const total = costs?.reduce((s, c) => s + c.amount, 0) ?? 0;
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Costs</h2>
          <p className="text-xs text-ink-faint">Logistics, fees, bags… anything that reduces profit.</p>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Icon name="plus" /> Add cost
        </Button>
      </div>
      {!costs ? (
        error ? <Empty>{error}</Empty> : <Spinner />
      ) : costs.length === 0 ? (
        <Empty>No costs in this period.</Empty>
      ) : (
        <Card>
          <ul>
            {costs.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
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
          </ul>
          <div className="flex justify-between border-t border-line px-4 py-2.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{rs(total)}</span>
          </div>
        </Card>
      )}
    </section>
  );
}

function HolderModal({
  holder,
  onClose,
  onSaved,
}: {
  holder: Holder | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open={!!holder} onClose={onClose} title={holder === "new" ? "Add shareholder" : "Edit shareholder"}>
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
    if (!h || !confirm(`Remove ${h.name}? Their shares stop counting in the split.`)) return;
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
    <form onSubmit={save} className="space-y-3">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </Field>
      <Field label="Contact" hint="Optional: phone or email">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
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
        <div className="text-xs text-ink-soft">
          Invested: <b>{rs(nShares * toPaisa(nPrice))}</b>
        </div>
      )}
      <Field label="Bought on" hint="Leave empty for today">
        <Input type="date" value={boughtOn} onChange={(e) => setBoughtOn(e.target.value)} />
      </Field>
      <Field label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-2">
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

function CostModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add cost">
      {open && <CostForm onSaved={onSaved} />}
    </Modal>
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
    <form onSubmit={save} className="space-y-3">
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
      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" disabled={!valid || busy}>
          {busy ? "Saving…" : "Add cost"}
        </Button>
      </div>
    </form>
  );
}
