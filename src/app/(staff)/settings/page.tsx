"use client";

import { useState } from "react";
import { getPosition } from "@/components/public/geo";
import type { ShopSettings } from "@/components/public/types";
import { toast } from "@/components/toast";
import { Button, Card, Empty, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

export default function SettingsPage() {
  const { isAdmin } = useMe();
  const { data } = useApi<{ shop: ShopSettings }>(isAdmin ? "/api/settings" : null);

  if (!isAdmin) return <Empty>Only admins can change shop settings.</Empty>;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" sub="Shop details shown on the public site and pre-order page." />
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

  const np = (k: keyof ShopSettings["nayapay"], v: string) => setS({ ...s, nayapay: { ...s.nayapay, [k]: v } });

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

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">NayaPay (pre-order advance payments)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account name">
            <Input value={s.nayapay.name} onChange={(e) => np("name", e.target.value)} />
          </Field>
          <Field label="NayaPay ID or number">
            <Input value={s.nayapay.handle} onChange={(e) => np("handle", e.target.value)} />
          </Field>
        </div>
        <Field label="Instructions for customers" hint="Defaults to asking them to put the order code in the payment note.">
          <Textarea value={s.nayapay.instructions} onChange={(e) => np("instructions", e.target.value)} />
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
