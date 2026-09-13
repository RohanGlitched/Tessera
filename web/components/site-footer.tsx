import Link from "next/link";
import { Mark } from "./mark";
import { WRITE_CLUSTER, TESSERA_PROGRAM_ID, explorerAddress } from "@/lib/config";
import { shortAddress } from "@/lib/format";

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-rule sm:mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <Mark className="size-5 text-ivory-dim" />
            <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
              Tessera composes tokenised equities into one token, backed share for
              share in a vault anyone can read. Prices and dividend multipliers come
              from Solana mainnet. Minting and redeeming settle on {WRITE_CLUSTER}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/compose" className="text-ivory-dim hover:text-ivory">
              Compose a basket
            </Link>
            <Link href="/explore" className="text-ivory-dim hover:text-ivory">
              Explore baskets
            </Link>
            <Link href="/portfolio" className="text-ivory-dim hover:text-ivory">
              Your holdings
            </Link>
            <Link href="/method" className="text-ivory-dim hover:text-ivory">
              How it works
            </Link>
            <a
              href={explorerAddress(TESSERA_PROGRAM_ID)}
              target="_blank"
              rel="noreferrer"
              className="tnum text-ivory-faint hover:text-ivory"
            >
              Program {shortAddress(TESSERA_PROGRAM_ID)}
            </a>
          </div>
        </div>

        <p className="mt-10 border-t border-rule pt-6 text-xs leading-relaxed text-ivory-faint">
          Not investment advice, and not an offer to sell anything. Tokenised
          equities are issued by Backed Finance; Tessera neither issues nor
          custodies them beyond the program vault a basket writes to.
        </p>
      </div>
    </footer>
  );
}
