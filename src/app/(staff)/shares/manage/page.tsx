"use client";

import { useState } from "react";
import { Disclosure, EmptyState } from "@/components/kit";
import { PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import {
  CostsLedger,
  HolderModal,
  Owners,
  periodQuery,
  ProfitPicture,
  ReviewRequests,
  SaleSettings,
  type Holder,
  type Period,
  type SharesSummary,
} from "./sections";

// Admins run the share sale here; their own shares are on /shares like everyone's.
export default function ManageSharesPage() {
  const { isAdmin } = useMe();
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Manage shares" />
        <EmptyState title="Only admins can manage shares" description="Your own shares are under My shares." />
      </div>
    );
  return <Manage />;
}

function Manage() {
  const [period, setPeriod] = useState<Period>({ kind: "all", from: "", to: "" });
  const sum = useApi<SharesSummary>(`/api/shares/summary${periodQuery(period)}`);
  const [editing, setEditing] = useState<Holder | "new" | null>(null);
  const d = sum.data;

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <PageHeader title="Manage shares" sub="Approve share requests, set the share price, and see who gets what." />
      <StaleNote stale={sum.stale} />

      <ReviewRequests onDecided={sum.reload} />

      {!d ? (
        <div className="grid place-items-center py-16">{sum.error ? <EmptyState title={sum.error} /> : <Spinner />}</div>
      ) : (
        <>
          <Owners d={d} period={period} onEdit={setEditing} onAdd={() => setEditing("new")} />
          <ProfitPicture d={d} period={period} onPeriod={setPeriod} />
        </>
      )}

      <SaleSettings onSaved={sum.reload} />

      <Disclosure summary="Running costs">
        <CostsLedger period={period} onChanged={sum.reload} />
      </Disclosure>

      <HolderModal
        holder={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          sum.reload();
        }}
      />
    </div>
  );
}
