// Imports the menu (names, categories, prices, photos) from the reference
// site into this app, through this app's own API. Safe to re-run: items that
// already exist with the same name and price are skipped.
//
//   node scripts/import-reference.mjs [--base http://localhost:3000]
//        [--email admin@seecs.edu.pk] [--demo-stock]
//
// Needs a running app with DEV_LOGIN=1 and the email in ADMIN_EMAILS.
// --demo-stock also restocks each item (in: 24, low: 3, out: 0) at 80% of the
// sell price so the counter can be tested. Don't use it for real data: those
// buy prices are made up.

const REF = "https://khaapa.deeznust.com";
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("base", "http://localhost:3000");
const EMAIL = opt("email", process.env.ADMIN_EMAILS?.split(",")[0]?.trim() || "admin.bscs23seecs@seecs.edu.pk");
const DEMO_STOCK = args.includes("--demo-stock");
const DEMO_QTY = { in: 24, low: 3, out: 0 };

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
function keepCookies(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie: cookieHeader(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.error ?? ""}`);
  return data;
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  keepCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/dev`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: cookieHeader(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: EMAIL }),
  });
  keepCookies(res);
  const me = await call("/api/me").catch(() => null);
  if (me?.user?.role !== "admin" || me.user.status !== "active") {
    throw new Error(`Couldn't sign in as an admin with ${EMAIL}. Is DEV_LOGIN=1 and the email in ADMIN_EMAILS?`);
  }
  console.log(`Signed in as ${me.user.email}`);
}

async function imageDataUrl(key) {
  if (!key) return null;
  const res = await fetch(`${REF}/api/img/${key}`);
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "image/webp";
  if (!/^image\/(webp|png|jpeg)$/.test(type)) return null;
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

await login();
const { items: refItems } = await (await fetch(`${REF}/api/public/items`)).json();
const { items: ours } = await call("/api/items?all=1");
const existing = new Set(ours.map((i) => `${i.name.trim().toLowerCase()}|${i.price}`));
console.log(`Reference has ${refItems.length} items; this app has ${ours.length}.`);

let created = 0;
let skipped = 0;
let stocked = 0;
for (const r of refItems) {
  const name = r.name.replace(/\s+/g, " ").trim();
  const price = Math.round(r.price * 100);
  if (existing.has(`${name.toLowerCase()}|${price}`)) {
    skipped++;
    continue;
  }
  const { item } = await call("/api/items", {
    method: "POST",
    body: {
      name,
      category: r.category || "Snacks",
      price,
      lowStockAt: 5,
      preorder: price > 0,
      image: await imageDataUrl(r.image_key),
    },
  });
  created++;
  const qty = DEMO_STOCK ? (DEMO_QTY[r.availability] ?? 0) : 0;
  if (qty > 0) {
    await call(`/api/items/${item.id}/stock`, {
      method: "POST",
      body: { kind: "restock", qty, unitCost: Math.round(price * 0.8), note: "Demo stock from seed import" },
    });
    stocked++;
  }
  process.stdout.write(`  + ${name} (Rs ${r.price})${qty ? ` · ${qty} in stock` : ""}\n`);
}
console.log(`Done: ${created} created, ${skipped} already there${DEMO_STOCK ? `, ${stocked} given demo stock` : ""}.`);
