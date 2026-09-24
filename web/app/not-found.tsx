import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-32 text-center sm:px-8">
      <p className="tnum text-sm text-ivory-faint">404</p>
      <h1 className="display text-title mt-3 text-ivory">Nothing laid here.</h1>
      <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-ivory-dim">
        This page does not exist. The market and every basket on the program are
        a click away.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-block border border-rule px-5 py-3 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
        >
          Back to the market
        </Link>
        <Link
          href="/explore"
          className="inline-block border border-rule px-5 py-3 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
        >
          See every basket
        </Link>
      </div>
    </div>
  );
}
