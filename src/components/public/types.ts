// Shapes returned by /api/public/* and /api/preorders.

export type PublicItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
  preorder: boolean;
  availability: "in" | "few" | "out";
};

export type DayStatus = { date: string; open: boolean; cutoff: string; note: string | null; accepting: boolean };

export type ShopSettings = {
  location: { lat: number; lng: number; label: string };
  hours: string;
  whatsapp: string;
};

/** A payment account as customers see it (see /api/accounts). */
export type PaymentAccount = {
  id: string;
  label: string;
  provider: string;
  accountTitle: string;
  accountNumber: string;
};

export type ShopInfo = { shop: ShopSettings; days: DayStatus[]; account: PaymentAccount | null };

export type PreorderStatus = "awaiting_payment" | "paid" | "ready" | "collected" | "cancelled";

export type PreorderLine = { itemId: string; name: string; qty: number; unitPrice: number };

export const STATUS_LABEL: Record<PreorderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  ready: "Ready for pickup",
  collected: "Collected",
  cancelled: "Cancelled",
};

export const STATUS_TONE = {
  awaiting_payment: "warn",
  paid: "accent",
  ready: "good",
  collected: "neutral",
  cancelled: "bad",
} as const;
