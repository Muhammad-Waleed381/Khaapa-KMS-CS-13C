"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, cx, Empty, PageHeader, Spinner, type Tone } from "@/components/ui";
import { api } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/time";

type Row = {
  id: string;
  kind: string;
  message: string;
  ref: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
};

// Kinds are matched by prefix, so "stock" also shows "stock.restock" etc.
const KINDS: { id: string; label: string; tone: Tone }[] = [
  { id: "sale", label: "Sales", tone: "neutral" },
  { id: "stock", label: "Stock", tone: "accent" },
  { id: "item", label: "Items", tone: "accent" },
  { id: "shift", label: "Shifts", tone: "good" },
  { id: "preorder", label: "Pre-orders", tone: "accent" },
  { id: "schedule", label: "Schedule", tone: "good" },
  { id: "team", label: "Team", tone: "warn" },
  { id: "shares", label: "Shares", tone: "warn" },
  { id: "settings", label: "Settings", tone: "neutral" },
];

const toneFor = (kind: string): Tone =>
  kind.includes("void") ? "bad" : (KINDS.find((k) => kind.startsWith(k.id))?.tone ?? "neutral");

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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity" sub="Everything staff do is logged here." />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ id: "", label: "All" }, ...KINDS].map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={cx(
              "rounded-full border px-3 py-1 text-xs font-medium",
              kind === k.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-soft hover:text-ink",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {error && !rows.length && <Empty>{error}</Empty>}
      {!loading && !error && !rows.length && <Empty>Nothing logged yet.</Empty>}

      {rows.length > 0 && (
        <Card className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="flex gap-3 px-4 py-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-ink-soft">
                {(r.userName ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{r.userName ?? "Customer"}</span>{" "}
                  <span className="text-ink-soft">{r.message}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                  <Badge tone={toneFor(r.kind)}>{r.kind}</Badge>
                  {fmtDateTime(r.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-4 flex justify-center">
        {loading ? (
          <Spinner />
        ) : (
          next && (
            <Button onClick={() => load(next)}>Load more</Button>
          )
        )}
      </div>
    </div>
  );
}
