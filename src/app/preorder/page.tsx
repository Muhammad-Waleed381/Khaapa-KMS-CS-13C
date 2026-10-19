"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicHeader } from "@/components/public/header";
import { ItemThumb } from "@/components/public/item-thumb";
import { PaymentStep } from "@/components/public/payment-step";
import { MyOrders, rememberOrder } from "@/components/public/my-orders";
import type { PaymentAccount, PublicItem, ShopInfo } from "@/components/public/types";
import { toast } from "@/components/toast";
import { Button, Card, cx, Empty, Field, Input, Spinner, Textarea } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate } from "@/lib/time";

type Placed = { id: string; code: string; total: number; account: PaymentAccount | null };

export default function PreorderPage() {
  const { data: info } = useApi<ShopInfo>("/api/public/info");
  const { data: menu, loading } = useApi<{ items: PublicItem[] }>("/api/public/items");
  const [date, setDate] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [ordersKey, setOrdersKey] = useState(0);

  // Remember the customer's details for next time.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("khaapa:customer") ?? "{}");
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);

  const days = useMemo(() => info?.days ?? [], [info]);
  const chosen = date ?? days.find((d) => d.accepting)?.date ?? null;
  const items = (menu?.items ?? []).filter((i) => i.preorder);
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && byId.has(id))
    .map(([id, qty]) => ({ item: byId.get(id)!, qty }));
  const total = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const accepting = days.some((d) => d.accepting);

  const bump = (id: string, by: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + by)) }));

  async function place() {
    if (!chosen) return;
    setBusy(true);
    try {
      const res = await api<Placed>("/api/public/preorder", {
        body: {
          customerName: name,
          phone,
          pickupDate: chosen,
          note: note || undefined,
          lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
        },
      });
      try {
        localStorage.setItem("khaapa:customer", JSON.stringify({ name, phone }));
      } catch {}
      rememberOrder(res);
      setPlaced(res);
      setCart({});
      setOrdersKey((k) => k + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  const onPaid = useCallback(() => {
    setPlaced(null);
    setOrdersKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-dvh pb-28">
      <PublicHeader active="preorder" />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">Pre-order</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Order for today or tomorrow, pay in advance online, and pick it up at {info?.shop.location.label ?? "SEECS"}.
        </p>

        {placed ? (
          <div className="mt-6">
            <PaymentStep order={placed} account={placed.account ?? info?.account} onDone={onPaid} />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {days.map((d, i) => (
                <button
                  key={d.date}
                  disabled={!d.accepting}
                  onClick={() => setDate(d.date)}
                  className={cx(
                    "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                    chosen === d.date ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-ink-faint",
                  )}
                >
                  <div className="text-sm font-semibold">{i === 0 ? "Today" : "Tomorrow"}</div>
                  <div className="text-xs text-ink-soft">{fmtDate(d.date)}</div>
                  <div className={cx("mt-1 text-xs", d.accepting ? "text-emerald-700 dark:text-emerald-400" : "text-ink-faint")}>
                    {d.accepting
                      ? i === 0
                        ? `Order before ${fmtClock(d.cutoff)}`
                        : "Open"
                      : d.open
                        ? `Closed at ${fmtClock(d.cutoff)}`
                        : "Closed"}
                  </div>
                  {d.note && <div className="mt-1 text-xs text-ink-faint">{d.note}</div>}
                </button>
              ))}
            </div>

            {info && !accepting ? (
              <div className="mt-6">
                <Empty>Pre-orders are closed right now. Check back later or visit the shop.</Empty>
              </div>
            ) : (
              <>
                <h2 className="mt-8 mb-3 text-sm font-semibold">Choose items</h2>
                {loading && !menu ? (
                  <div className="grid place-items-center py-10">
                    <Spinner />
                  </div>
                ) : items.length === 0 ? (
                  <Empty>No items are available for pre-order.</Empty>
                ) : (
                  <Card className="divide-y divide-line">
                    {items.map((i) => {
                      const qty = cart[i.id] ?? 0;
                      const out = i.availability === "out";
                      return (
                        <div key={i.id} className={cx("flex items-center gap-3 p-3", out && "opacity-50")}>
                          <ItemThumb name={i.name} image={i.image} className="size-12 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{i.name}</div>
                            <div className="text-xs text-ink-soft">
                              {rs(i.price)}
                              {out ? " · Sold out" : i.availability === "few" ? " · Few left" : ""}
                            </div>
                          </div>
                          {qty > 0 ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" onClick={() => bump(i.id, -1)} aria-label={`Remove one ${i.name}`}>
                                −
                              </Button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                              <Button size="sm" onClick={() => bump(i.id, 1)} aria-label={`Add one ${i.name}`}>
                                +
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" disabled={out} onClick={() => bump(i.id, 1)}>
                              Add
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                )}

                {lines.length > 0 && (
                  <Card className="mt-6 space-y-3 p-4">
                    <h2 className="text-sm font-semibold">Your details</h2>
                    <Field label="Name">
                      <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </Field>
                    <Field label="Phone (WhatsApp)" hint="We'll only use it about this order.">
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="03xx xxxxxxx"
                      />
                    </Field>
                    <Field label="Note (optional)">
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="min-h-14" />
                    </Field>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        <MyOrders refreshKey={ordersKey} account={info?.account} />
      </div>

      {!placed && lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink-soft">
                {lines.reduce((s, l) => s + l.qty, 0)} item{lines.length > 1 || lines[0].qty > 1 ? "s" : ""} ·{" "}
                {chosen ? fmtDate(chosen) : "pick a day"}
              </div>
              <div className="text-lg font-semibold tabular-nums">{rs(total)}</div>
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={busy || !chosen || name.trim().length < 2 || phone.trim().length < 10}
              onClick={place}
            >
              {busy ? "Placing…" : "Place order"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
