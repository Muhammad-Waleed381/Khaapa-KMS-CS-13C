import Link from "next/link";
import { directionsUrl } from "./geo";
import type { ShopSettings } from "./types";
import { StaffLink } from "@/components/staff-link";

const wa = (n: string) => `https://wa.me/${n.replace(/[^0-9]/g, "").replace(/^0/, "92")}`;

/** The back of the card: a sign-off, the hours, and where to find the shop. */
export function PublicFooter({ shop }: { shop?: ShopSettings }) {
  const hours = shop?.hours.trim().split("\n").filter(Boolean) ?? [];
  const loc = shop?.location;
  return (
    <footer className="bg-(--pub-ground) px-0 pt-20 pb-10 md:px-8 md:pt-24">
      <div className="edge-scallop-top relative mx-auto max-w-5xl bg-(--pub-paper) px-6 pt-14 pb-8 text-(--pub-paper-ink) md:px-14 md:pt-16">
        {/* The stamp: the shop's mark where a postcard keeps its stamp. */}
        <div aria-hidden className="absolute top-8 right-6 bg-(--pub-paper) p-1.5 md:top-10 md:right-14">
          <div className="grid h-[85px] w-16 place-items-center bg-(--pub-green) font-display text-3xl text-(--pub-green-ink) md:h-[117px] md:w-[88px] md:text-4xl">
            KS
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="pr-20 md:pr-0">
            <p className="font-display text-[2rem] leading-[1.05] md:text-[2.5rem]">See you at the counter</p>
            <div className="mt-4 space-y-1">
              {hours.length ? hours.map((h) => <p key={h}>{h}</p>) : <p>Opening hours are posted at the counter.</p>}
              <p className="text-(--pub-paper-soft)">Cash or online.</p>
            </div>
          </div>
          <ul className="space-y-3 text-[1.0625rem] md:pt-28 md:text-lg">
            <li>
              {loc ? (
                <a href={directionsUrl(loc)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  {loc.label}
                </a>
              ) : (
                "SEECS, NUST H-12"
              )}
            </li>
            {shop?.whatsapp && (
              <li>
                <a href={wa(shop.whatsapp)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  WhatsApp {shop.whatsapp}
                </a>
              </li>
            )}
            <li>
              <Link href="/preorder" className="underline-offset-4 hover:underline">
                Order ahead
              </Link>
            </li>
            <li>
              <Link href="/contribution" className="underline-offset-4 hover:underline">
                Contribution
              </Link>
            </li>
            <li>
              <StaffLink className="underline-offset-4 hover:underline" />
            </li>
          </ul>
        </div>
        <p className="mt-12 text-center text-[0.8125rem] text-(--pub-paper-soft)">
          Khaapa SEECS · NUST H-12, Islamabad
        </p>
      </div>
    </footer>
  );
}
