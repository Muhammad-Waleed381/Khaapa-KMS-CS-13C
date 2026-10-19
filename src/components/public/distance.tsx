"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { directionsUrl, fmtDistance, getPosition, haversine, walkMinutes } from "./geo";
import type { ShopSettings } from "./types";

/** "How far am I?" — one tap, distance and walking time to the shop. */
export function DistanceCheck({ shop }: { shop?: ShopSettings }) {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "done"; metres: number } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const loc = shop?.location;

  async function check() {
    if (!loc) return;
    setState({ kind: "busy" });
    try {
      const me = await getPosition();
      setState({ kind: "done", metres: haversine(me, loc) });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="pin" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{loc?.label ?? "K2 Block, NUST H-12"}</div>
          {state.kind === "done" ? (
            <p className="mt-0.5 text-sm text-ink-soft">
              {state.metres < 40 ? (
                "You're here. Come on in!"
              ) : (
                <>
                  <b className="text-ink">{fmtDistance(state.metres)}</b> away · about{" "}
                  <b className="text-ink">{walkMinutes(state.metres)} min</b> on foot
                </>
              )}
            </p>
          ) : state.kind === "error" ? (
            <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{state.message}</p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-soft">Check how far you are from the shop.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={check} disabled={!loc || state.kind === "busy"}>
              {state.kind === "busy" ? "Locating…" : state.kind === "done" ? "Check again" : "How far am I?"}
            </Button>
            {loc && (
              <a
                href={directionsUrl(loc)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-8 items-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium shadow-sm hover:bg-muted"
              >
                Directions
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
