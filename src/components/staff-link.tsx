"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// The staff app caches the signed-in user under this key (see (staff)/layout.tsx).
const ME_KEY = "khaapa:me";

/**
 * The public site's way into the staff app. Shows "Open Khaapa" for someone
 * already signed in on this device, so a fresh tab never looks signed out.
 */
export function StaffLink({ className, children = "Staff login" }: { className?: string; children?: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedIn(!!localStorage.getItem(ME_KEY));
    } catch {}
  }, []);
  return (
    <Link href={signedIn ? "/home" : "/login"} className={className}>
      {signedIn ? "Open Khaapa" : children}
    </Link>
  );
}
