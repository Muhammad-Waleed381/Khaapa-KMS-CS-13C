"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/client/api";
import { MAX_UNITS, unitsLabel } from "@/lib/units";
import { pkDate } from "@/lib/time";

export type Member = { id: string; name: string };
export type Entry = { id: string; userId: string; name: string; date: string; units: number; note: string };

/** Log a contribution, or edit one. Admins only: the page only opens it for them. */
export function EntryDialog({
  open,
  onClose,
  members,
  entry,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  entry: Entry | null;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(pkDate());
  const [units, setUnits] = useState(2);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setUserId(entry?.userId ?? members[0]?.id ?? "");
    setDate(entry?.date ?? pkDate());
    setUnits(entry?.units ?? 2);
    setNote(entry?.note ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, entry, members]);

  async function save() {
    if (!userId) return toast("Pick a member", "bad");
    setBusy(true);
    try {
      const body = { userId, date, units, note: note.trim() };
      if (entry) await api(`/api/contributions/${entry.id}`, { method: "PATCH", body });
      else await api("/api/contributions", { body });
      toast(entry ? "Entry updated" : "Contribution logged");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit contribution" : "Log contribution"}>
      <div className="grid gap-4 pt-2">
        <Field label="Member">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} max={pkDate()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" hint="Counted in 30-minute units">
            <Select value={units} onChange={(e) => setUnits(Number(e.target.value))}>
              {Array.from({ length: MAX_UNITS }, (_, i) => i + 1).map((u) => (
                <option key={u} value={u}>
                  {unitsLabel(u)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="What was it for?" hint="Optional. Shown on the public page.">
          <Textarea
            value={note}
            maxLength={200}
            placeholder="Restocked the shelves, cleaned the counter…"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !userId}>
            {busy ? "Saving…" : entry ? "Save changes" : "Log contribution"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
