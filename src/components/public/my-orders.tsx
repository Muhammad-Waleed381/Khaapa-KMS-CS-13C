"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Modal } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { PaymentStep } from "./payment-step";
import { STATUS_LABEL, STATUS_TONE, type PreorderLine, type PreorderStatus, type ShopSettings } from "./types";

const KEY = "khaapa:my-preorders";

type Saved = { id: string; code: string };
type Order = {
  id: string;
  code: string;
  pickupDate: string;
  lines: PreorderLine[];
  total: number;
  status: PreorderStatus;
  paymentRef: string | null;
};

function readSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberOrder(o: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify([o, ...readSaved().filter((s) => s.id !== o.id)].slice(0, 20)));
  } catch {}
}

/** The customer's own orders on this device, refreshed every 30 s. */
export function MyOrders({ refreshKey, shop }: { refreshKey: number; shop?: ShopSettings }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paying, setPaying] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const saved = readSaved();
    if (!saved.length) return;
    try {
      const res = await api<{ orders: Order[] }>(`/api/public/preorders?codes=${saved.map((s) => s.code).join(",")}`);
      setOrders(res.orders);
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  if (!orders.length) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold">My orders</h2>
      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-base font-bold tracking-widest">{o.code}</div>
                <div className="text-xs text-ink-soft">Pickup {fmtDate(o.pickupDate)}</div>
              </div>
              <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
            </div>
            <div className="mt-2 text-sm text-ink-soft">
              {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">{rs(o.total)}</span>
              {o.status === "awaiting_payment" &&
                (o.paymentRef ? (
                  <span className="text-xs text-ink-faint">Payment sent · being checked</span>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => setPaying(o)}>
                    Send payment
                  </Button>
                ))}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Pay for your order">
        {paying && (
          <PaymentStep
            order={paying}
            shop={shop}
            onDone={() => {
              setPaying(null);
              load();
            }}
          />
        )}
      </Modal>
    </section>
  );
}
