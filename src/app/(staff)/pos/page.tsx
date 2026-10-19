"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BanknoteIcon, ChevronDownIcon, ClockIcon, SmartphoneIcon } from "lucide-react";
import { ActionCard } from "@/components/kit";
import { Badge, Button, cx, Empty, Input, Modal, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { useMe } from "@/lib/client/me";
import { describeAccount, localCurrentAccount, useAccounts } from "@/lib/client/offline/accounts";
import { db, type CachedItem, type LocalSale } from "@/lib/client/offline/db";
import { OnDuty } from "@/components/on-duty";
import { adoptShift, endShift, holdShift, startShift, useLocalShift, type LocalShift } from "@/lib/client/offline/shift";
import {
  cancelPendingSale,
  queueAccountSwitch,
  queueSale,
  refreshItems,
  retryFailed,
  syncNow,
  useCounterItems,
  useLive,
  useSyncState,
} from "@/lib/client/offline/sync";
import { slotForShift } from "@/lib/duty";
import { rs, toPaisa } from "@/lib/money";
import { fmtClock, pkDate, pkTime } from "@/lib/time";

type Line = { itemId: string; name: string; unitPrice: number; qty: number };

export default function PosPage() {
  const me = useMe();
  const sync = useSyncState();
  const items = useCounterItems();
  const shift = useLocalShift(me.user.id);

  // A shift opened on another device (or before a reinstall) carries over.
  useEffect(() => {
    if (!shift && me.shift && me.shift.userId === me.user.id && !me.shift.endedAt) {
      adoptShift({ id: me.shift.id, userId: me.shift.userId, startedAt: me.shift.startedAt });
    }
  }, [shift, me.shift, me.user.id]);

  // First visit on this device: load the menu.
  useEffect(() => {
    if (items === null) refreshItems().catch(() => {});
  }, [items]);

  if (!shift) return <StartShift me={me} />;
  if (items === null)
    return (
      <div className="grid min-h-[60vh] place-items-center text-center text-sm text-ink-soft">
        {sync.online ? (
          <Spinner />
        ) : (
          <p>
            The menu hasn&apos;t been downloaded on this device yet.
            <br />
            Connect to the internet once to start selling offline.
          </p>
        )}
      </div>
    );
  const slot = slotForShift(shift, me.slots);
  return <Counter items={items} shift={shift} slotEnd={slot?.end ?? null} onShiftChange={me.reload} />;
}

function StartShift({ me }: { me: ReturnType<typeof useMe> }) {
  const [busy, setBusy] = useState(false);
  const others = me.onCounter.filter((o) => o.userId !== me.user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4 md:pt-12">
      <div>
        <h1 className="font-display text-4xl md:text-5xl">Counter</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Ring up sales here. Start your shift first so every sale is recorded under your name.</p>
      </div>
      <ActionCard
        icon={<ClockIcon className="size-6" />}
        title="Start your shift"
        description="Selling works even when the internet drops. Sales upload by themselves later."
        cta={busy ? "Starting…" : "Start shift"}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          await startShift(me.user.id);
          toast("Shift started. You're on the counter");
          syncNow().then(me.reload);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <OnDuty slots={me.slots} />
        {others.length > 0 && (
          <div className="rounded-2xl bg-muted px-3 py-2.5 text-xs">
            <div className="font-medium text-ink-faint">Also on the counter</div>
            <div className="mt-1 font-medium text-ink">{others.map((o) => o.name).join(", ")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Counter({
  items,
  shift,
  slotEnd,
  onShiftChange,
}: {
  items: CachedItem[];
  shift: LocalShift;
  slotEnd: string | null;
  onShiftChange: () => Promise<void>;
}) {
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<CachedItem | null>(null);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => items.filter((i) => i.active), [items]);
  const categories = useMemo(() => [...new Set(active.map((i) => i.category))].sort(), [active]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((i) => (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q)));
  }, [active, category, query]);

  const inCart = (id: string) => cart.find((l) => l.itemId === id)?.qty ?? 0;
  const total = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  // A sale in progress keeps the shift open past the end of the duty slot.
  useEffect(() => {
    holdShift(cart.length > 0);
    return () => holdShift(false);
  }, [cart.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addUnchecked(item: CachedItem) {
    setCart((c) => {
      const found = c.find((l) => l.itemId === item.id);
      if (found) return c.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { itemId: item.id, name: item.name, unitPrice: item.price, qty: 1 }];
    });
  }

  function add(item: CachedItem) {
    if (item.stock - inCart(item.id) <= 0 && !allowed.has(item.id)) {
      setConfirmItem(item);
      return;
    }
    addUnchecked(item);
  }

  function setQty(itemId: string, qty: number) {
    if (qty > 0) {
      const item = items.find((i) => i.id === itemId);
      const current = inCart(itemId);
      if (item && qty > current && item.stock - current <= 0 && !allowed.has(itemId)) {
        setConfirmItem(item);
        return;
      }
    }
    setCart((c) => (qty <= 0 ? c.filter((l) => l.itemId !== itemId) : c.map((l) => (l.itemId === itemId ? { ...l, qty } : l))));
  }

  async function complete(method: "cash" | "online", cashReceived: number | null) {
    const id = crypto.randomUUID();
    // Online money goes to whichever account is current on this device.
    const account = method === "online" ? await localCurrentAccount() : null;
    await queueSale(
      {
        id,
        createdAt: new Date().toISOString(),
        method,
        cashReceived: method === "cash" ? cashReceived : null,
        shiftId: shift.id,
        accountId: account?.id ?? null,
        lines: cart.map(({ itemId, name, qty, unitPrice }) => ({ itemId, name, qty, unitPrice })),
      },
      account ? describeAccount(account) : null,
    );
    const change = method === "cash" && cashReceived != null ? cashReceived - total : 0;
    toast(
      method === "cash"
        ? `Sale saved · change ${rs(change)}`
        : `Sale saved · ${rs(total)} online${account ? ` to ${account.label}` : ""}`,
    );
    setCart([]);
    setAllowed(new Set());
    setCartOpen(false);
  }

  const cartPanel = (inSheet: boolean) => (
    <CartPanel cart={cart} total={total} onQty={setQty} onClear={() => setCart([])} onComplete={complete} inSheet={inSheet} />
  );

  return (
    <div className="-mx-4 -my-5 md:-mx-8 md:-my-7 lg:flex lg:h-dvh">
      <div className="min-w-0 flex-1 px-4 py-4 pb-28 md:px-6 lg:overflow-y-auto lg:pb-6">
        <CounterHeader shift={shift} slotEnd={slotEnd} onRecent={() => setRecentOpen(true)} onEnd={() => setEndOpen(true)} />

        <div className="sticky top-[52px] z-10 -mx-1 mb-3 space-y-2 bg-bg/95 px-1 py-2 backdrop-blur md:top-0">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
                if (e.key === "Enter" && shown.length === 1) {
                  add(shown[0]);
                  setQuery("");
                }
              }}
              placeholder="Search items   ( / )"
              className="pl-9"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? "all"}
                  onClick={() => setCategory(c)}
                  className={cx(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-line bg-surface text-ink-soft hover:text-ink",
                  )}
                >
                  {c ?? "All"}
                </button>
              ))}
            </div>
          )}
        </div>

        {shown.length === 0 ? (
          <Empty>{active.length ? "No items match." : "No items yet. Add some on the Items page."}</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {shown.map((item) => (
              <ItemTile key={item.id} item={item} qty={inCart(item.id)} onAdd={() => add(item)} />
            ))}
          </div>
        )}
      </div>

      <aside className="hidden w-[380px] shrink-0 border-l border-line bg-surface lg:flex lg:flex-col">{cartPanel(false)}</aside>

      {count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-xl bg-primary px-4 py-3.5 text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="text-sm font-medium">
            {count} item{count > 1 ? "s" : ""} · Checkout
          </span>
          <span className="text-base font-semibold tabular-nums">{rs(total)}</span>
        </button>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Current sale">
        <div className="-mx-4 -mb-6 sm:-mx-6">{cartPanel(true)}</div>
      </Modal>

      <Modal open={!!confirmItem} onClose={() => setConfirmItem(null)} title="Out of stock">
        {confirmItem && (
          <>
            <p className="text-sm text-ink-soft">
              <b className="text-ink">{confirmItem.name}</b> shows{" "}
              <b className="text-ink">{Math.max(confirmItem.stock - inCart(confirmItem.id), 0)}</b> on the shelf. Sell
              anyway? It will be recorded as an oversell so the stock can be corrected.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setConfirmItem(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setAllowed((a) => new Set(a).add(confirmItem.id));
                  addUnchecked(confirmItem);
                  setConfirmItem(null);
                }}
              >
                Sell anyway
              </Button>
            </div>
          </>
        )}
      </Modal>

      <RecentSales open={recentOpen} onClose={() => setRecentOpen(false)} />

      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="End your shift?">
        <p className="text-sm text-ink-soft">
          You started at {fmtClock(pkTime(shift.startedAt))}. You&apos;ll need to start a new shift to sell again.
        </p>
        {cart.length > 0 && <p className="mt-2 text-sm text-warn">The current cart will be cleared.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setEndOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              setEndOpen(false);
              await endShift(shift);
              toast("Shift ended");
              syncNow().then(onShiftChange);
            }}
          >
            End shift
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function useTodayTotals() {
  return useLive(
    async () => {
      const today = pkDate();
      const sales = await db.sales.toArray();
      let cash = 0;
      let online = 0;
      let n = 0;
      for (const s of sales) {
        if (s.status === "cancelled" || s.status === "failed" || pkDate(s.createdAt) !== today) continue;
        n++;
        if (s.method === "cash") cash += s.total;
        else online += s.total;
      }
      return { cash, online, n };
    },
    [],
    { cash: 0, online: 0, n: 0 },
  );
}

function CounterHeader({
  shift,
  slotEnd,
  onRecent,
  onEnd,
}: {
  shift: LocalShift;
  slotEnd: string | null;
  onRecent: () => void;
  onEnd: () => void;
}) {
  const totals = useTodayTotals();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Counter</h1>
          <p className="mt-1 text-sm text-ink-soft">
            On shift since {fmtClock(pkTime(shift.startedAt))}
            {slotEnd && ` · ends at ${fmtClock(slotEnd)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm"
          >
            <span className="text-ink-soft">Today</span>
            <span className="font-semibold tabular-nums">{rs(totals.cash + totals.online)}</span>
            <ChevronDownIcon className={cx("size-4 text-ink-faint transition", open && "rotate-180")} />
          </button>
          <Button size="sm" onClick={onRecent}>
            Recent
          </Button>
          <Button size="sm" variant="ghost" onClick={onEnd}>
            End shift
          </Button>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
          <div>
            <div className="text-xs text-ink-soft">Cash</div>
            <div className="font-semibold tabular-nums">{rs(totals.cash)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-soft">Online</div>
            <div className="font-semibold tabular-nums">{rs(totals.online)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-soft">Sales</div>
            <div className="font-semibold tabular-nums">{totals.n}</div>
          </div>
          <p className="col-span-3 text-xs text-ink-faint">Sales rung up on this device today.</p>
        </div>
      )}
    </div>
  );
}

function ItemTile({ item, qty, onAdd }: { item: CachedItem; qty: number; onAdd: () => void }) {
  const left = item.stock - qty;
  return (
    <button
      onClick={onAdd}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface text-left transition active:scale-[.97]",
        qty > 0 ? "border-primary ring-2 ring-primary/20" : "border-line hover:border-ink-faint",
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
        {item.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/img/${item.id}?v=${item.imageVersion}`}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-3xl font-bold text-ink-faint">
            {item.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        {qty > 0 && (
          <span className="absolute right-2 top-2 grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
            {qty}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 text-[0.9375rem] font-medium leading-snug">{item.name}</div>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <span className="text-base font-semibold tabular-nums">{rs(item.price)}</span>
          {left <= 0 ? (
            <Badge tone="bad">Out</Badge>
          ) : left <= item.lowStockAt ? (
            <Badge tone="warn">{left} left</Badge>
          ) : (
            <span className="text-[11px] text-ink-faint tabular-nums">{left}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CartPanel({
  cart,
  total,
  onQty,
  onClear,
  onComplete,
  inSheet,
}: {
  cart: Line[];
  total: number;
  onQty: (itemId: string, qty: number) => void;
  onClear: () => void;
  onComplete: (method: "cash" | "online", cashReceived: number | null) => Promise<void>;
  /** Shown in the phone sheet, which already has its own title. */
  inSheet: boolean;
}) {
  const [method, setMethod] = useState<"cash" | "online">("cash");
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const { accounts, current } = useAccounts();
  const [picking, setPicking] = useState(false);

  const receivedPaisa = received.trim() === "" ? total : toPaisa(Number(received));
  const validCash = Number.isFinite(receivedPaisa) && receivedPaisa >= total;
  const canComplete = cart.length > 0 && !busy && (method === "online" || validCash);

  async function submit() {
    if (!canComplete) return;
    setBusy(true);
    try {
      await onComplete(method, method === "cash" ? receivedPaisa : null);
      setReceived("");
      setMethod("cash");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cx("flex items-center justify-between px-5 pb-2", inSheet ? "pt-0" : "pt-4")}>
        <h2 className={cx("text-sm font-semibold", inSheet && "sr-only")}>Current sale</h2>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-xs text-ink-faint hover:text-destructive">
            Clear
          </button>
        )}
      </div>

      <div className="min-h-24 flex-1 overflow-y-auto px-5">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">Tap items to add them.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cart.map((l) => (
              <li key={l.itemId} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-ink-faint tabular-nums">{rs(l.unitPrice)} each</div>
                </div>
                <div className="flex items-center rounded-md border border-line">
                  <button className="p-1.5 text-ink-soft hover:text-ink" onClick={() => onQty(l.itemId, l.qty - 1)} aria-label="Less">
                    <Icon name="minus" />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                  <button className="p-1.5 text-ink-soft hover:text-ink" onClick={() => onQty(l.itemId, l.qty + 1)} aria-label="More">
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="w-20 text-right text-sm font-semibold tabular-nums">{rs(l.qty * l.unitPrice)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 border-t border-line px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">Total</span>
          <span className="font-display text-5xl tabular-nums">{rs(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
          {(
            [
              { m: "cash", label: "Cash", Icon: BanknoteIcon },
              { m: "online", label: "Online", Icon: SmartphoneIcon },
            ] as const
          ).map(({ m, label, Icon: PayIcon }) => (
            <button
              key={m}
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cx(
                "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition",
                method === m ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-faint",
              )}
            >
              <PayIcon className="size-5" />
              {label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="space-y-2.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Customer gave (Rs)</span>
              <Input
                inputMode="numeric"
                placeholder={`${total / 100} (exact)`}
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="h-11 text-lg tabular-nums"
              />
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: "Exact", v: total },
                { label: "50", v: 5000 },
                { label: "100", v: 10000 },
                { label: "500", v: 50000 },
                { label: "1000", v: 100000 },
              ].map((b) => (
                <button
                  key={b.label}
                  disabled={b.v < total || cart.length === 0}
                  onClick={() => setReceived(String(b.v / 100))}
                  className="rounded-lg border border-line py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div
              className={cx(
                "flex items-center justify-between rounded-2xl px-4 py-3",
                validCash ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950",
              )}
            >
              <span className={cx("text-sm font-medium", validCash ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                {validCash ? "Give back" : "Still needed"}
              </span>
              <span
                className={cx(
                  "font-display text-5xl tabular-nums",
                  validCash ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300",
                )}
              >
                {rs(Math.abs((Number.isFinite(receivedPaisa) ? receivedPaisa : 0) - total))}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl bg-muted px-4 py-3 text-sm text-ink-soft">
            {current ? (
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-xs">Paid to</span>
                  <b className="block truncate text-ink">{describeAccount(current)}</b>
                </span>
                <button onClick={() => setPicking(true)} className="shrink-0 rounded-md px-2 py-1 font-medium text-primary hover:bg-surface">
                  Change
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span>No payment account chosen{accounts.length ? "" : ". An admin can add one in Settings"}.</span>
                {accounts.length > 0 && (
                  <button onClick={() => setPicking(true)} className="shrink-0 font-medium text-primary hover:underline">
                    Choose
                  </button>
                )}
              </div>
            )}
            <p className="text-xs">
              Check the payment of <b className="text-ink">{rs(total)}</b> has arrived, then complete the sale.
            </p>
          </div>
        )}
        <AccountPicker open={picking} onClose={() => setPicking(false)} />

        <Button variant="primary" size="lg" className="h-12 w-full text-base" disabled={!canComplete} onClick={submit}>
          {cart.length ? `Complete sale · ${rs(total)}` : "Complete sale"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Switch the account online payments go to. It stays until someone switches
 * again; works offline and uploads with the next sync.
 */
function AccountPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, current } = useAccounts();
  return (
    <Modal open={open} onClose={onClose} title="Online payments go to">
      {accounts.length === 0 ? (
        <Empty>No payment accounts yet. An admin can add them in Settings.</Empty>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => {
            const active = a.id === current?.id;
            return (
              <li key={a.id}>
                <button
                  onClick={async () => {
                    if (!active) {
                      await queueAccountSwitch(a.id);
                      toast(`Online payments now go to ${a.label}`);
                    }
                    onClose();
                  }}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition hover:bg-muted",
                    active ? "border-primary bg-primary-soft" : "border-line",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-sm font-medium">
                    {a.label}
                    {active && <Badge tone="good">Current</Badge>}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {a.provider} · {a.accountTitle} · <span className="font-mono">{a.accountNumber}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-faint">Every online sale after this is recorded against the chosen account.</p>
    </Modal>
  );
}

function RecentSales({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sales = useLive<LocalSale[]>(
    () => db.sales.orderBy("createdAt").reverse().limit(40).toArray(),
    [],
    [],
  );
  return (
    <Modal open={open} onClose={onClose} title="Recent sales on this device" wide>
      {sales.length === 0 ? (
        <Empty>No sales on this device yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {sales.map((s) => (
            <li key={s.id} className={cx("flex items-start gap-3 py-3", s.status === "cancelled" && "opacity-50")}>
              <div className="w-16 shrink-0 text-xs text-ink-faint tabular-nums">
                {fmtClock(pkTime(s.createdAt))}
                <div>{pkDate(s.createdAt) === pkDate() ? "" : pkDate(s.createdAt).slice(5)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={s.method === "cash" ? "neutral" : "accent"}>{s.method}</Badge>
                  {s.method === "online" && s.accountLabel && <span className="text-xs text-ink-faint">to {s.accountLabel}</span>}
                  {s.status === "pending" && <Badge tone="warn">Not synced</Badge>}
                  {s.status === "failed" && <Badge tone="bad">Rejected: {s.error}</Badge>}
                  {s.status === "cancelled" && <Badge>Cancelled</Badge>}
                  {s.change ? <span className="text-xs text-ink-faint">change {rs(s.change)}</span> : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{rs(s.total)}</div>
                {s.status === "pending" && (
                  <button
                    className="mt-1 text-xs text-destructive hover:underline"
                    onClick={async () => {
                      await cancelPendingSale(s.id);
                      toast("Sale cancelled");
                    }}
                  >
                    Cancel
                  </button>
                )}
                {s.status === "failed" && (
                  <button className="mt-1 text-xs text-primary hover:underline" onClick={() => retryFailed()}>
                    Retry
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-faint">
        Synced sales can be voided from the Sales page. Unsynced ones can be cancelled here.
      </p>
    </Modal>
  );
}
