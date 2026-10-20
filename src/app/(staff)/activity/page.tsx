"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock,
  Coins,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Undo2,
  Users,
  Wallet,
  type LucideIcon,
  HandHeart,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/kit";
import { Button, Card, cx, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { addDays, fmtClock, fmtDate, pkDate, pkTime } from "@/lib/time";

type Row = {
  id: string;
  kind: string;
  message: string;
  ref: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
};

/** Consecutive sales by one person, shown as one line. */
type Run = { id: string; userId: string | null; userName: string | null; sales: Row[] };
type Entry = Row | Run;

// Kinds are matched by prefix, so "stock" also shows "stock.restock" etc.
const KINDS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "sale", label: "Sales", icon: ShoppingCart },
  { id: "stock", label: "Stock", icon: Package },
  { id: "item", label: "Items", icon: Tag },
  { id: "shift", label: "Shifts", icon: Clock },
  { id: "preorder", label: "Pre-orders", icon: ClipboardList },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "account", label: "Accounts", icon: Wallet },
  { id: "shares", label: "Shares", icon: Coins },
  { id: "cost", label: "Costs", icon: Receipt },
  { id: "contribution", label: "Contribution", icon: HandHeart },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

// Icon elements built once, so rendering a row never creates a component.
const ICON = Object.fromEntries(KINDS.map((k) => [k.id, <k.icon key={k.id} className="size-4" aria-hidden />]));
const VOID_ICON = <Undo2 className="size-4" aria-hidden />;
const OTHER_ICON = <ClipboardList className="size-4" aria-hidden />;

function iconFor(kind: string) {
  if (kind.includes("void")) return VOID_ICON;
  return ICON[KINDS.find((k) => kind.startsWith(k.id))?.id ?? ""] ?? OTHER_ICON;
}

function dayTitle(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return fmtDate(day);
}

export default function ActivityPage() {
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before: string | null) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "50" });
        if (kind) qs.set("kind", kind);
        if (before) qs.set("before", before);
        const page = await api<{ rows: Row[]; next: string | null }>(`/api/activity?${qs}`);
        setRows((r) => (before ? [...r, ...page.rows] : page.rows));
        setNext(page.next);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(null);
  }, [load]);

  // By day, with each run of one person's sales folded into a single entry.
  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const r of rows) {
      const d = pkDate(r.createdAt);
      const list = map.get(d) ?? [];
      const last = list[list.length - 1];
      if (r.kind === "sale" && last && "sales" in last && last.userId === r.userId) last.sales.push(r);
      else list.push(r.kind === "sale" ? { id: r.id, userId: r.userId, userName: r.userName, sales: [r] } : r);
      map.set(d, list);
    }
    return [...map.entries()];
  }, [rows]);
  const today = rows.length ? pkDate() : "";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <PageHeader title="Activity" sub="Everything anyone does in Khaapa, newest first. Useful when money or stock doesn't add up." />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {[{ id: "", label: "Everything", icon: null as LucideIcon | null }, ...KINDS].map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  kind === k.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-soft hover:text-ink",
                )}
              >
                {Icon && <Icon className="size-3.5" aria-hidden />}
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && !rows.length && <EmptyState title="Couldn't load activity" description={error} />}
      {!loading && !error && !rows.length && (
        <EmptyState title="Nothing here yet" description={kind ? "Try another filter." : "Actions like sales, restocks and approvals appear here."} />
      )}

      {groups.map(([day, items]) => (
        <section key={day} className="space-y-3">
          <h2 className="sticky top-14 z-10 bg-bg/90 py-1 text-sm font-semibold text-ink backdrop-blur md:top-0">{dayTitle(day, today)}</h2>
          <Card className="divide-y divide-line border border-line">
            {items.map((e) => ("sales" in e && e.sales.length > 1 ? <SalesRun key={e.id} run={e} /> : <Item key={e.id} r={"sales" in e ? e.sales[0] : e} />))}
          </Card>
        </section>
      ))}

      <div className="flex justify-center">
        {loading ? (
          <Spinner />
        ) : (
          next && (
            <Button size="lg" onClick={() => load(next)}>
              Show older
            </Button>
          )
        )}
      </div>
    </div>
  );
}

const VERBS = /^(renamed|sold|started|ended|added|edited|archived|restored|deleted|restocked|wrote|counted|voided|approved|rejected|disabled|re-enabled|assigned|copied|removed|updated|opened|closed|raised|requested|made|changed|switched|turned|marked|verified|cancelled|handed|set)$/i;

/** "Restocked 24 × Cola" reads as "<name> restocked 24 × Cola"; null when it doesn't start with an action. */
function sentence(text: string) {
  const [first] = text.split(" ");
  return VERBS.test(first) ? text[0].toLowerCase() + text.slice(1) : null;
}

function Item({ r }: { r: Row }) {
  const icon = iconFor(r.kind);
  const voided = r.kind.includes("void");
  // Some messages already start with the person's name.
  const who = r.userName && !r.message.startsWith(r.userName) ? r.userName : null;
  const s = sentence(r.message);
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <div
        className={cx(
          "grid size-9 shrink-0 place-items-center rounded-full",
          voided ? "bg-destructive/10 text-destructive" : "bg-muted text-ink-soft",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">
          {who && <span className="font-semibold">{who}{s ? " " : " · "}</span>}
          {!who && r.userName && r.message.startsWith(r.userName) ? (
            <>
              <span className="font-semibold">{r.userName}</span>
              <span className="text-ink-soft">{r.message.slice(r.userName.length)}</span>
            </>
          ) : (
            <span className={who ? "text-ink-soft" : ""}>{who ? (s ?? r.message) : r.message}</span>
          )}
        </p>
        <div className="mt-0.5 text-xs text-ink-faint tabular-nums">{fmtClock(pkTime(r.createdAt))}</div>
      </div>
    </div>
  );
}

/** "Fatima Noor made 14 sales · Rs 1,240", opening to the individual sales. */
function SalesRun({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  // Messages look like "Sold 3 items · Rs 120 cash"; add the amounts up.
  const total = run.sales.reduce((sum, r) => sum + rupeesIn(r.message), 0);
  const first = run.sales[run.sales.length - 1];
  const last = run.sales[0];
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full gap-3 px-4 py-3.5 text-left hover:bg-muted/40">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ink-soft">
          <ShoppingCart className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-ink">
            <span className="font-semibold">{run.userName ?? "Someone"} </span>
            <span className="text-ink-soft">
              made {run.sales.length} sales{total ? ` · Rs ${total.toLocaleString("en-PK")}` : ""}
            </span>
          </p>
          <div className="mt-0.5 text-xs text-ink-faint tabular-nums">
            {fmtClock(pkTime(first.createdAt))} – {fmtClock(pkTime(last.createdAt))} · {open ? "hide" : "show"} each sale
          </div>
        </div>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-line bg-muted/30 px-4 py-3 pl-16 text-sm text-ink-soft">
          {run.sales.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span>{r.message.replace(/^Sold /, "")}</span>
              <span className="shrink-0 text-xs text-ink-faint tabular-nums">{fmtClock(pkTime(r.createdAt))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Sold 3 items · Rs 1,120 cash" -> 1120 */
function rupeesIn(message: string) {
  const m = message.match(/Rs ([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}
