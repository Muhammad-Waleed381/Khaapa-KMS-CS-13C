"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui";
import { useMe } from "@/lib/client/me";

// Where sign-in lands: admins start on the Dashboard, everyone else on the Counter.
export default function HomePage() {
  const { isAdmin } = useMe();
  const router = useRouter();
  useEffect(() => router.replace(isAdmin ? "/stats" : "/pos"), [isAdmin, router]);
  return (
    <div className="grid place-items-center py-20">
      <Spinner />
    </div>
  );
}
