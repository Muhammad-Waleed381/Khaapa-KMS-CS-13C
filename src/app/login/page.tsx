"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button, Card, Input } from "@/components/ui";

const DEV_LOGIN = process.env.NEXT_PUBLIC_DEV_LOGIN === "1";

export default function LoginPage() {
  const [next, setNext] = useState("/pos");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.get("next")?.startsWith("/")) setNext(q.get("next")!);
    if (q.get("error")) setError("Use your @seecs.edu.pk Google account to sign in.");
  }, []);

  return (
    <div className="relative grid min-h-dvh place-items-center p-4">
      <ThemeToggle className="absolute top-4 right-4 size-9 text-ink-soft hover:bg-muted hover:text-ink" />
      <Card className="w-full max-w-sm p-6">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Khaapa<span className="text-primary">.</span>
        </Link>
        <h1 className="mt-4 text-lg font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Sign in with your SEECS Google account. New accounts need an admin&apos;s approval.
        </p>
        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => signIn("google", { redirectTo: next })}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="#fff" d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.85.55 3.9 1.45l2.15-2.15A9 9 0 1 0 12 21c5.2 0 8.65-3.65 8.65-8.8 0-.4-.05-.75-.1-1.1z" />
          </svg>
          Continue with Google
        </Button>

        {DEV_LOGIN && (
          <form
            className="mt-6 space-y-2 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn("dev", { email, redirectTo: next });
            }}
          >
            <div className="text-xs font-medium text-ink-faint">Dev login (local only)</div>
            <Input placeholder="name.bscs23seecs@seecs.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" className="w-full">
              Sign in without Google
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
