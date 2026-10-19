import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Progress } from "@/components/ui/progress";
import { rs } from "@/lib/money";

export type CashierRow = { userId: string; name: string; count: number; revenue: number; cash: number; online: number };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Who sold the most, as a leaderboard: the leader gets a featured card, everyone else a ranked row. */
export function CashierBoard({ rows }: { rows: CashierRow[] }) {
  const ranked = [...rows].sort((a, b) => b.revenue - a.revenue);
  const total = ranked.reduce((s, r) => s + r.revenue, 0);
  const sales = ranked.reduce((s, r) => s + r.count, 0);
  const share = (r: CashierRow) => (total ? (r.revenue / total) * 100 : 0);
  const [leader, ...others] = ranked;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-faint">Team revenue</p>
          <p className="font-display text-3xl tabular-nums">
            <span className="mr-1 text-base text-ink-soft normal-case">Rs</span>
            <NumberTicker value={total / 100} />
          </p>
        </div>
        <p className="pb-1 text-right text-xs text-ink-faint tabular-nums">
          {sales} sales · {ranked.length} {ranked.length === 1 ? "cashier" : "cashiers"}
        </p>
      </div>

      <BlurFade inView>
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20">
          <BorderBeam size={160} duration={6} colorFrom="#ffffff" colorTo="#84b872" borderWidth={1.5} />
          <div className="flex items-center gap-4">
            <Avatar className="size-14 ring-2 ring-primary-foreground/30">
              <AvatarFallback className="bg-primary-foreground text-lg font-bold text-primary">
                {initials(leader.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase opacity-75">Top seller</p>
              <p className="truncate text-lg font-semibold">{leader.name}</p>
            </div>
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold tabular-nums">
              {leader.count} {leader.count === 1 ? "sale" : "sales"}
            </span>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <p className="font-display text-4xl tabular-nums">
              <span className="mr-1.5 text-lg normal-case opacity-80">Rs</span>
              <NumberTicker value={leader.revenue / 100} />
            </p>
            <p className="pb-1 text-xs opacity-80 tabular-nums">{Math.round(share(leader))}% of revenue</p>
          </div>
          <Progress
            value={share(leader)}
            className="mt-3 h-1.5 bg-primary-foreground/20 [&_[data-slot=progress-indicator]]:bg-primary-foreground"
          />
          <div className="mt-3 flex justify-between text-xs opacity-80 tabular-nums">
            <span>Cash {rs(leader.cash)}</span>
            <span>Online {rs(leader.online)}</span>
          </div>
        </div>
      </BlurFade>

      {others.length > 0 && (
        <ol className="space-y-1">
          {others.map((r, i) => (
            <BlurFade key={r.userId} inView delay={0.05 * (i + 1)}>
              <li className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/60">
                <span className="w-5 text-center font-display text-lg text-ink-faint tabular-nums">{i + 2}</span>
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                    {initials(r.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="font-semibold tabular-nums">{rs(r.revenue)}</span>
                  </div>
                  <Progress value={share(r)} className="mt-2 h-1" />
                  <p className="mt-1.5 text-xs text-ink-faint tabular-nums">
                    {r.count} {r.count === 1 ? "sale" : "sales"} · {Math.round(share(r))}%
                  </p>
                  <p className="text-xs text-ink-faint tabular-nums">
                    Cash {rs(r.cash)} · Online {rs(r.online)}
                  </p>
                </div>
              </li>
            </BlurFade>
          ))}
        </ol>
      )}
    </div>
  );
}
