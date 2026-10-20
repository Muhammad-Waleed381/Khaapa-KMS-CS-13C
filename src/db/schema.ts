import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money is stored in paisa (1 PKR = 100 paisa) as integers, so FIFO unit
// costs like Rs 1,000 / 24 stay exact enough without floating point.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  status: text("status", { enum: ["pending", "active", "disabled"] }).notNull().default("pending"),
  approvedBy: uuid("approved_by"),
  createdAt: createdAt(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Snacks"),
  price: integer("price").notNull(),
  // Webp data URL, served through /api/img/[id] so item lists stay small.
  image: text("image"),
  lowStockAt: integer("low_stock_at").notNull().default(5),
  preorder: boolean("preorder").notNull().default(true),
  active: boolean("active").notNull().default(true),
  // Units sold while the shelf was empty that have not been costed yet; the
  // next restock pays them off first (FIFO).
  owed: integer("owed").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A batch bought at one unit cost. Removals consume the oldest lot first.
export const lots = pgTable(
  "lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id),
    qtyIn: integer("qty_in").notNull(),
    qtyLeft: integer("qty_left").notNull(),
    unitCost: integer("unit_cost").notNull(),
    supplier: text("supplier"),
    createdAt: createdAt(),
  },
  (t) => [index("lots_item_idx").on(t.itemId, t.createdAt)],
);

export const MOVE_KINDS = ["restock", "sale", "void", "waste", "correction", "settle"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

// Append-only stock ledger. Stock on hand is SUM(qty) per item.
// cost is the FIFO value of the units that left (or came back, negative).
export const stockMoves = pgTable(
  "stock_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id),
    kind: text("kind", { enum: MOVE_KINDS }).notNull(),
    qty: integer("qty").notNull(),
    cost: integer("cost").notNull().default(0),
    unitCost: integer("unit_cost"),
    // Which lots this move drew from, so a void can put units back.
    allocations: jsonb("allocations").$type<{ lotId: string; qty: number; unitCost: number }[]>(),
    oversold: integer("oversold").notNull().default(0),
    saleId: uuid("sale_id"),
    supplier: text("supplier"),
    note: text("note"),
    userId: uuid("user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("moves_item_idx").on(t.itemId, t.createdAt), index("moves_sale_idx").on(t.saleId)],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("shifts_user_idx").on(t.userId, t.startedAt)],
);

// Sale ids are generated on the device so offline sales sync exactly once.
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    shiftId: uuid("shift_id"),
    method: text("method", { enum: ["cash", "online"] }).notNull(),
    total: integer("total").notNull(),
    cost: integer("cost").notNull().default(0),
    cashReceived: integer("cash_received"),
    change: integer("change"),
    oversold: boolean("oversold").notNull().default(false),
    preorderId: uuid("preorder_id"),
    // Online sales: the payment account that received the money (null for cash,
    // and for sales recorded before accounts existed).
    accountId: uuid("account_id"),
    voided: boolean("voided").notNull().default(false),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sales_created_idx").on(t.createdAt)],
);

export const saleLines = pgTable(
  "sale_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id").notNull().references(() => sales.id),
    itemId: uuid("item_id").notNull().references(() => items.id),
    name: text("name").notNull(),
    qty: integer("qty").notNull(),
    unitPrice: integer("unit_price").notNull(),
    cost: integer("cost").notNull().default(0),
    oversold: integer("oversold").notNull().default(0),
  },
  (t) => [index("lines_sale_idx").on(t.saleId)],
);

// Recurring weekly windows a member says they can work (0 = Monday).
export const availability = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  weekday: smallint("weekday").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const slots = pgTable(
  "slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("slots_date_idx").on(t.date)],
);

export const preorderDays = pgTable("preorder_days", {
  date: date("date").primaryKey(),
  open: boolean("open").notNull().default(true),
  cutoff: text("cutoff").notNull().default("12:00"),
  note: text("note"),
});

export const PREORDER_STATUSES = ["awaiting_payment", "paid", "ready", "collected", "cancelled"] as const;
export type PreorderStatus = (typeof PREORDER_STATUSES)[number];

export const preorders = pgTable(
  "preorders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    note: text("note"),
    pickupDate: date("pickup_date").notNull(),
    lines: jsonb("lines").$type<{ itemId: string; name: string; qty: number; unitPrice: number }[]>().notNull(),
    total: integer("total").notNull(),
    status: text("status", { enum: PREORDER_STATUSES }).notNull().default("awaiting_payment"),
    paymentRef: text("payment_ref"),
    proof: text("proof"),
    // The account the customer was asked to pay into.
    accountId: uuid("account_id"),
    saleId: uuid("sale_id"),
    updatedBy: uuid("updated_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("preorders_code_idx").on(t.code), index("preorders_day_idx").on(t.pickupDate)],
);

export const shareholders = pgTable("shareholders", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Set when the holding came from an approved purchase request; null for
  // holdings an admin entered by hand.
  userId: uuid("user_id"),
  purchaseId: uuid("purchase_id"),
  name: text("name").notNull(),
  contact: text("contact"),
  shares: integer("shares").notNull(),
  pricePerShare: integer("price_per_share").notNull(),
  boughtOn: date("bought_on").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

// Running costs that reduce profit (logistics, fees, bags...).
export const costs = pgTable("costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  amount: integer("amount").notNull(),
  note: text("note").notNull(),
  userId: uuid("user_id"),
  createdAt: createdAt(),
});

// Work logged by hand, in 30-minute units (1 unit = 30 min, 2 = 1 h). Counter
// shifts are not stored here: their units are worked out from the shift times.
export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    units: smallint("units").notNull(),
    note: text("note").notNull().default(""),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("contributions_date_idx").on(t.date), index("contributions_user_idx").on(t.userId)],
);

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    ref: text("ref"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// Accounts that receive online payments (NayaPay, JazzCash, Easypaisa, bank).
// Details change over time, so old records keep pointing at the account row
// they were paid into; deactivate an account instead of deleting it.
export const paymentAccounts = pgTable("payment_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  provider: text("provider").notNull(),
  accountTitle: text("account_title").notNull(),
  accountNumber: text("account_number").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export const SHARE_PURCHASE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type SharePurchaseStatus = (typeof SHARE_PURCHASE_STATUSES)[number];

// A request to buy shares. The price is copied from the share settings when the
// request is made, so later price changes never alter it. Approving one creates
// a shareholders row.
export const sharePurchases = pgTable(
  "share_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    shares: integer("shares").notNull(),
    pricePerShare: integer("price_per_share").notNull(),
    total: integer("total").notNull(),
    accountId: uuid("account_id"),
    paymentRef: text("payment_ref"),
    proof: text("proof"),
    status: text("status", { enum: SHARE_PURCHASE_STATUSES }).notNull().default("pending"),
    note: text("note"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("share_purchases_user_idx").on(t.userId)],
);
