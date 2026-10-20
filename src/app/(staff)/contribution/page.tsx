"use client";

import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "@/components/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button, Card, cx, Empty, PageHeader, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { unitsLabel } from "@/lib/units";
import { fmtDate, pkDate, weekStart } from "@/lib/time";
import { EntryDialog, type Entry, type Member } from "./entry-dialog";

type Person = { userId: string; name: string; units: number; shiftUnits: number; manualUnits: number };
type Board = {
  today: string;
  totals: { units: number; shiftUnits: number; manualUnits: number; people: number };
  people: Person[];
  entries: Entry[];
  canEdit: boolean;
  members?: Member[];
};

type Preset = "week" | "month" | "all";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

/** The PKT dates a preset covers. "All time" leaves both ends open. */
function rangeFor(preset: Preset, today: string) {
  if (preset === "week") return { from: weekStart(today), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: null, to: null };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

// Everyone signed in can see the board. Admins log, edit and delete entries.
export default function ContributionPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const today = pkDate();
  const range = useMemo(() => rangeFor(preset, today), [preset, today]);
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v) as [string, string][]).toString();
  const { data, loading, reload } = useApi<Board>(`/api/contributions${qs ? `?${qs}` : ""}`);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(e: Entry) {
    setEditing(e);
    setDialogOpen(true);
  }
  async function remove(e: Entry) {
    if (!window.confirm(`Delete ${unitsLabel(e.units)} logged for ${e.name}?`)) return;
    try {
      await api(`/api/contributions/${e.id}`, { method: "DELETE" });
      toast("Entry deleted");
      reload();
    } catch (err) {
      toast((err as Error).message, "bad");
    }
  }

  const top = data?.people[0]?.units ?? 0;
  const manualShare = data?.totals.units ? Math.round((data.totals.manualUnits / data.totals.units) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        title="Contribution"
        sub="Every counter shift counts automatically. Anything else that keeps the shop running, an admin logs here in 30-minute units."
        actions={
          data?.canEdit && (
            <Button variant="primary" onClick={openNew}>
              <PlusIcon /> Log contribution
            </Button>
          )
        }
      />
      <div role="tablist" aria-label="Period" className="inline-flex rounded-full border border-line p-1 text-sm">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={cx(
              "rounded-full px-4 py-1.5 font-medium transition",
              preset === p.id ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-muted hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

        <div className="space-y-6">
          {!data ? (
            loading ? (
              <div className="grid place-items-center py-20">
                <Spinner />
              </div>
            ) : (
              <Empty>Couldn&apos;t load the contribution board. Try again in a moment.</Empty>
            )
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <Tile label="Team time" value={unitsLabel(data.totals.units) || "0m"} sub={`${data.totals.units} units`} />
                <Tile label="People" value={String(data.totals.people)} sub="contributed this period" />
                <Tile label="Logged by hand" value={`${manualShare}%`} sub={`${unitsLabel(data.totals.manualUnits) || "0m"} of the total`} />
              </div>

              <Card className="p-5 md:p-6">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl">Who&apos;s put in the time</h2>
                    <p className="mt-1 text-sm text-ink-faint">
                      {preset === "all" ? "All time" : `${fmtDate(range.from!)} – ${fmtDate(range.to!)}`}
                    </p>
                  </div>
                </div>
                {data.people.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">Nothing logged for this period yet.</p>
                ) : (
                  <ol className="space-y-1">
                    {data.people.map((p, i) => (
                      <li key={p.userId} className="flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-muted/60">
                        <span className="w-7 text-center font-display text-2xl text-ink-faint tabular-nums">{i + 1}</span>
                        <Avatar className="size-10">
                          <AvatarFallback className={cx("text-sm font-semibold", i === 0 ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate font-semibold">{p.name}</span>
                            <span className="font-display text-2xl normal-case tabular-nums">{unitsLabel(p.units)}</span>
                          </div>
                          <Progress value={top ? (p.units / top) * 100 : 0} className="mt-2 h-1.5" />
                          <p className="mt-1.5 text-xs text-ink-faint tabular-nums">
                            {p.shiftUnits > 0 && `Counter shifts ${unitsLabel(p.shiftUnits)}`}
                            {p.shiftUnits > 0 && p.manualUnits > 0 && " · "}
                            {p.manualUnits > 0 && `Logged ${unitsLabel(p.manualUnits)}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-6 border-t border-line pt-4 text-xs text-ink-faint">
                  1 unit = 30 minutes. Counter shifts count in full 30-minute blocks, so a 75-minute shift is 2 units.
                </p>
              </Card>

              <Card className="p-5 md:p-6">
                <h2 className="mb-4 font-display text-3xl">Logged by hand</h2>
                {data.entries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No hand-logged work for this period.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.entries.map((e) => (
                      <li key={e.id} className="flex items-start gap-4 py-3">
                        <div className="w-24 shrink-0 text-xs text-ink-faint tabular-nums">{fmtDate(e.date)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3">
                            <span className="font-semibold">{e.name}</span>
                            <span className="text-sm tabular-nums text-ink-soft">{unitsLabel(e.units)}</span>
                          </div>
                          {e.note && <p className="mt-0.5 text-sm text-ink-soft">{e.note}</p>}
                        </div>
                        {data.canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(e)} aria-label="Edit entry">
                              <PencilIcon />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(e)} aria-label="Delete entry">
                              <Trash2Icon />
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>

      {data?.canEdit && data.members && (
        <EntryDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          members={data.members}
          entry={editing}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-3 md:p-5">
      <div className="text-[0.75rem] font-medium text-muted-foreground md:text-[0.8125rem]">{label}</div>
      <div className="mt-1 font-display text-2xl normal-case tabular-nums md:mt-2 md:text-4xl">{value}</div>
      <div className="mt-1 hidden text-xs text-ink-faint md:block">{sub}</div>
    </Card>
  );
}
