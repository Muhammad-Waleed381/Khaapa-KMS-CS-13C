"use client";

import { useState } from "react";
import { getPosition } from "@/components/public/geo";
import type { ShopSettings } from "@/components/public/types";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

export default function SettingsPage() {
  const { isAdmin } = useMe();
  const { data } = useApi<{ shop: ShopSettings }>(isAdmin ? "/api/settings" : null);

  if (!isAdmin) return <Empty>Only admins can change shop settings.</Empty>;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" sub="Shop details shown on the public site and pre-order page." />
      <AccountsCard />
      {data ? (
        <SettingsForm key={JSON.stringify(data.shop)} initial={data.shop} />
      ) : (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}
    </div>
  );
}

function SettingsForm({ initial }: { initial: ShopSettings }) {
  const [s, setS] = useState(initial);
  const [lat, setLat] = useState(String(initial.location.lat));
  const [lng, setLng] = useState(String(initial.location.lng));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  async function useHere() {
    setLocating(true);
    try {
      const p = await getPosition();
      setLat(p.lat.toFixed(6));
      setLng(p.lng.toFixed(6));
      toast("Location filled in. Save to apply.");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLocating(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return toast("Latitude and longitude must be numbers", "bad");
    setBusy(true);
    try {
      await api("/api/settings", { body: { ...s, location: { ...s.location, lat: la, lng: ln } } });
      toast("Settings saved");
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Shop location</h2>
        <p className="text-xs text-ink-soft">Used for the “How far am I?” check and directions on the public site.</p>
        <Field label="Label">
          <Input
            value={s.location.label}
            onChange={(e) => setS({ ...s, location: { ...s.location, label: e.target.value } })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Longitude">
            <Input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={useHere} disabled={locating}>
            {locating ? "Locating…" : "Use my current location"}
          </Button>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium text-ink-soft hover:bg-muted hover:text-ink"
          >
            Check on map
          </a>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Opening hours and contact</h2>
        <Field label="Opening hours" hint="Shown as written, e.g. “Mon–Fri 9 am – 5 pm”.">
          <Textarea value={s.hours} onChange={(e) => setS({ ...s, hours: e.target.value })} />
        </Field>
        <Field label="WhatsApp number">
          <Input
            value={s.whatsapp}
            onChange={(e) => setS({ ...s, whatsapp: e.target.value })}
            inputMode="tel"
            placeholder="+92 3xx xxxxxxx"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

const PROVIDERS = ["NayaPay", "JazzCash", "Easypaisa", "Bank", "Other"] as const;

type Account = {
  id: string;
  label: string;
  provider: (typeof PROVIDERS)[number];
  accountTitle: string;
  accountNumber: string;
  active: boolean;
};

type Draft = Omit<Account, "id" | "active">;
const EMPTY: Draft = { label: "", provider: "NayaPay", accountTitle: "", accountNumber: "" };

/**
 * Accounts that receive online money. Old payments keep pointing at the account
 * they went into, so accounts are turned off rather than deleted.
 */
function AccountsCard() {
  const { data, reload } = useApi<{ accounts: Account[]; currentId: string | null }>("/api/accounts");
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const accounts = data?.accounts ?? [];

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
      await reload();
      return true;
    } catch (e) {
      toast((e as Error).message, "bad");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, draft } = editing;
    const ok = await run(
      () => (id ? api(`/api/accounts/${id}`, { method: "PATCH", body: draft }) : api("/api/accounts", { body: draft })),
      id ? "Account updated" : "Account added",
    );
    if (ok) setEditing(null);
  }

  const set = (k: keyof Draft, v: string) => editing && setEditing({ ...editing, draft: { ...editing.draft, [k]: v } });

  return (
    <Card className="mb-5 space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Payment accounts</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Where online payments go. The <b>current</b> account receives counter sales and pre-orders; cashiers can switch
            it from the Counter. Every payment remembers the account it went into.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setEditing({ id: null, draft: EMPTY })}>
          Add account
        </Button>
      </div>

      {!data ? (
        <div className="grid place-items-center py-6">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-ink-soft">
          No accounts yet. Add one so customers know where to pay and online sales are tracked by account.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {accounts.map((a) => {
            const current = a.id === data.currentId;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {a.label}
                    {current && <Badge tone="good">Current</Badge>}
                    {!a.active && <Badge tone="bad">Off</Badge>}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {a.provider} · {a.accountTitle} · <span className="font-mono">{a.accountNumber}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.active && !current && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => api("/api/accounts/current", { body: { accountId: a.id } }), `Online payments now go to ${a.label}`)}
                    >
                      Make current
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({
                        id: a.id,
                        draft: { label: a.label, provider: a.provider, accountTitle: a.accountTitle, accountNumber: a.accountNumber },
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api(`/api/accounts/${a.id}`, { method: "PATCH", body: { active: !a.active } }),
                        a.active ? `${a.label} turned off` : `${a.label} turned on`,
                      )
                    }
                  >
                    {a.active ? "Turn off" : "Turn on"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit account" : "Add payment account"}>
        {editing && (
          <form onSubmit={saveDraft} className="space-y-3">
            <Field label="What it's for" hint="e.g. “Shop main”, “Pre-orders”, “Ali's NayaPay”.">
              <Input value={editing.draft.label} onChange={(e) => set("label", e.target.value)} required />
            </Field>
            <Field label="Provider">
              <Select value={editing.draft.provider} onChange={(e) => set("provider", e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Account title" hint="The name the customer sees when sending money.">
              <Input value={editing.draft.accountTitle} onChange={(e) => set("accountTitle", e.target.value)} required />
            </Field>
            <Field label="Account number / IBAN">
              <Input
                value={editing.draft.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
                className="font-mono"
                required
              />
            </Field>
            {editing.id && (
              <p className="text-xs text-ink-soft">
                Changing the number changes it for past payments too. If the account itself changed, turn this one off and
                add a new one instead.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
