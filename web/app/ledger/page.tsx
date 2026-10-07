import type { Metadata } from "next";
import { LedgerPage } from "@/components/ledger";

export const metadata: Metadata = {
  title: "The ledger",
  description:
    "Every basket created, every share created and every share redeemed, decoded from the program's own events. No database, no indexer.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <LedgerPage />
    </div>
  );
}
