import { Suspense } from "react";
import { connection } from "next/server";
import { ContributionBoard } from "./board";

// Today's date and the signed-in viewer are only known per request, so the board
// streams in behind a fallback rather than being prerendered.
export default function ContributionPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[60dvh] place-items-center text-sm text-ink-faint">Loading the board…</div>}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  await connection();
  return <ContributionBoard />;
}
