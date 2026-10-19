"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { OnDuty } from "@/components/on-duty";
import { SyncStatus } from "@/components/sync-status";
import { ThemeToggle } from "@/components/theme";
import { toast } from "@/components/toast";
import { Button, cx, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { MeContext, type DutySlotRow, type Me } from "@/lib/client/me";
import { useShiftAutoEnd } from "@/lib/client/offline/shift";
import { syncNow } from "@/lib/client/offline/sync";
import { fmtClock } from "@/lib/time";
import { NAV } from "./nav";

const ME_KEY = "khaapa:me";
const NO_SLOTS: DutySlotRow[] = [];

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const fresh = await api<Me>("/api/me");
      setMe(fresh);
      localStorage.setItem(ME_KEY, JSON.stringify(fresh));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        localStorage.removeItem(ME_KEY);
        router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      // Offline: carry on as the last signed-in user.
      const cached = localStorage.getItem(ME_KEY);
      if (cached) setMe(JSON.parse(cached));
    }
  }, [router]);

  useEffect(() => {
    const cached = localStorage.getItem(ME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setMe(JSON.parse(cached));
    reload();
  }, [reload]);

  // Pick up schedule edits and the next day's slots while the app stays open.
  useEffect(() => {
    const timer = setInterval(reload, 5 * 60_000);
    return () => clearInterval(timer);
  }, [reload]);

  const slots = me?.slots ?? NO_SLOTS;
  const onShiftAutoEnded = useCallback(
    (end: string) => {
      toast(`Your duty slot ended at ${fmtClock(end)}, so your shift was closed`);
      syncNow().then(reload);
    },
    [reload],
  );
  useShiftAutoEnd(me?.user.id ?? "", slots, onShiftAutoEnded);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [pathname]);

  if (!me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );

  if (me.user.status !== "active") return <Pending me={me} />;

  const isAdmin = me.user.role === "admin";
  const nav = NAV.filter((n) => !n.admin || isAdmin);

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {nav.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-muted hover:text-ink",
            )}
          >
            <Icon name={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="flex items-center gap-2 rounded-2xl bg-muted/60 p-2">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
        {me.user.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{me.user.name}</div>
        <div className="truncate text-xs text-ink-faint">{isAdmin ? "Admin" : "Member"}</div>
      </div>
      <button
        title="Sign out"
        onClick={() => {
          localStorage.removeItem(ME_KEY);
          signOut({ redirectTo: "/login" });
        }}
        className="rounded-xl p-2 text-ink-faint transition hover:bg-background hover:text-ink"
      >
        <Icon name="logout" />
      </button>
    </div>
  );

  return (
    <MeContext.Provider value={{ me, reload }}>
      <div className="min-h-dvh md:flex">
        <aside className="sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] w-56 shrink-0 flex-col gap-4 rounded-3xl border border-line bg-surface p-3 shadow-xl shadow-black/5 md:flex">
          <div className="flex items-center justify-between pt-1 pl-1.5">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <span className="grid size-8 place-items-center rounded-xl bg-primary font-display text-base text-primary-foreground">
                K
              </span>
              <span>
                Khaapa<span className="text-primary">.</span>
              </span>
            </Link>
            <ThemeToggle className="text-ink-faint hover:bg-muted hover:text-ink" />
          </div>
          <div className="flex-1 overflow-y-auto">{navList}</div>
          <OnDuty slots={slots} />
          <SyncStatus />
          {userBox}
        </aside>

        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Khaapa<span className="text-primary">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <SyncStatus />
            <ThemeToggle className="size-9 text-ink-soft hover:bg-muted hover:text-ink" />
            <button onClick={() => setMenuOpen(true)} className="rounded-md p-2 hover:bg-muted" aria-label="Menu">
              <Icon name="menu" className="size-5" />
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)}>
            <div
              className="rise absolute inset-y-2 right-2 flex w-64 flex-col gap-4 rounded-3xl border border-line bg-surface p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 overflow-y-auto pt-2">{navList}</div>
              <OnDuty slots={slots} />
              {userBox}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    </MeContext.Provider>
  );
}

function Pending({ me }: { me: Me }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <div className="text-lg font-bold">
          Khaapa<span className="text-primary">.</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold">
          {me.user.status === "disabled" ? "Your account is disabled" : "Waiting for approval"}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          You&apos;re signed in as <b>{me.user.email}</b>.{" "}
          {me.user.status === "disabled"
            ? "Ask an admin if this is a mistake."
            : "An admin needs to approve your account before you can use the counter."}
        </p>
        <Button className="mt-6" onClick={() => signOut({ redirectTo: "/login" })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
