"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./mark";
import { MarketClock } from "./market-clock";
import { ConnectButton } from "./connect-button";

const NAV = [
  { href: "/compose", label: "Compose" },
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    /* Pinned on a laptop, where the market clock and the wallet are worth keeping
       in reach. On a phone the destinations move to a second row, and two rows of
       chrome following you down a 390-pixel screen is too much to ask, so there
       the header scrolls away with everything else. */
    <header className="border-b border-rule bg-ground-deep/85 backdrop-blur-md sm:sticky sm:top-0 sm:z-40">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-ivory"
                    : "text-ivory-dim hover:text-ivory"
                }`}
              >
                {item.label}
                {active && (
                  <span className="mt-1 block h-px bg-gold" aria-hidden />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <div className="hidden md:block">
            <MarketClock compact />
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* The same three destinations, laid as tiles across the full width. */}
      <nav className="flex border-t border-rule text-sm sm:hidden">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 border-r border-rule py-3 text-center last:border-r-0 ${
                active ? "bg-ground-raised text-ivory" : "text-ivory-dim"
              }`}
            >
              {item.label}
              {active && (
                <span className="mx-auto mt-1 block h-px w-6 bg-gold" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
