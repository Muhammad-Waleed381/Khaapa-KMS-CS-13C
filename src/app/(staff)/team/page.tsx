"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Empty, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { fmtDateTime } from "@/lib/time";

type TeamUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "disabled";
  createdAt: string;
  lastShiftAt: string | null;
};

export default function TeamPage() {
  const { isAdmin, user: me } = useMe();
  const { data, stale, loading, reload } = useApi<{ users: TeamUser[] }>(isAdmin ? "/api/users" : null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAdmin) return <Empty>Only admins can manage the team.</Empty>;

  async function update(u: TeamUser, patch: Partial<Pick<TeamUser, "status" | "role">>, msg: string) {
    setBusy(u.id);
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", body: patch });
      toast(msg);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  const users = data?.users ?? [];
  const pending = users.filter((u) => u.status === "pending");
  const rest = users.filter((u) => u.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Team"
        sub="Approve new sign-ups, choose who is an admin, and disable people who have left."
      />
      <StaleNote stale={stale} />

      {loading && !data ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              Waiting for approval {pending.length > 0 && <Badge tone="warn">{pending.length}</Badge>}
            </h2>
            {pending.length === 0 ? (
              <Empty>No pending sign-ups.</Empty>
            ) : (
              <div className="space-y-2">
                {pending.map((u) => (
                  <Card key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                    <Avatar u={u} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{u.name}</div>
                      <div className="truncate text-xs text-ink-soft">{u.email}</div>
                      <div className="text-xs text-ink-faint">Signed up {fmtDateTime(u.createdAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy === u.id}
                        onClick={() => update(u, { status: "disabled" }, `Rejected ${u.name}`)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy === u.id}
                        onClick={() => update(u, { status: "active" }, `Approved ${u.name}`)}
                      >
                        Approve
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Members</h2>
            {rest.length === 0 ? (
              <Empty>Nobody yet.</Empty>
            ) : (
              <Card className="divide-y divide-line">
                {rest.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                      <Avatar u={u} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{u.name}</span>
                          {u.role === "admin" && <Badge tone="accent">Admin</Badge>}
                          {u.status === "disabled" && <Badge tone="bad">Disabled</Badge>}
                          {self && <Badge>You</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-soft">{u.email}</div>
                        <div className="text-xs text-ink-faint">
                          {u.lastShiftAt ? `Last shift ${fmtDateTime(u.lastShiftAt)}` : "No shifts yet"}
                        </div>
                      </div>
                      {!self && (
                        <div className="flex gap-2">
                          {u.status === "active" && (
                            <Button
                              size="sm"
                              disabled={busy === u.id}
                              onClick={() =>
                                update(
                                  u,
                                  { role: u.role === "admin" ? "member" : "admin" },
                                  u.role === "admin" ? `${u.name} is now a member` : `${u.name} is now an admin`,
                                )
                              }
                            >
                              {u.role === "admin" ? "Make member" : "Make admin"}
                            </Button>
                          )}
                          {u.status === "active" ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy === u.id}
                              onClick={() =>
                                confirm(`Disable ${u.name}? They won't be able to sign in.`) &&
                                update(u, { status: "disabled" }, `Disabled ${u.name}`)
                              }
                            >
                              Disable
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={busy === u.id}
                              onClick={() => update(u, { status: "active" }, `Re-enabled ${u.name}`)}
                            >
                              Enable
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Avatar({ u }: { u: TeamUser }) {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
      {u.name.slice(0, 1).toUpperCase()}
    </div>
  );
}
